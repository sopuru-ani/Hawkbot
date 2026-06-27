from dataclasses import dataclass
from typing import Any

from AI.retrieval.chunk_ids import neighbor_chunk_ids, parse_chunk_id
from AI.retrieval.hybrid import reciprocal_rank_fusion
from AI.retrieval.query_intent import is_list_intent


@dataclass(frozen=True)
class Source:
    title: str
    url: str


@dataclass(frozen=True)
class RetrievalResult:
    context: str
    sources: list[Source]


class Retriever:
    def __init__(
        self,
        pinecone_client,
        chunk_store,
        reranker,
        top_k: int,
        max_chunks_per_url: int,
        candidate_multiplier: int = 3,
        filtered_candidate_multiplier: int = 10,
        section_min_chunks: int = 5,
        neighbor_radius: int = 1,
        list_neighbor_radius: int = 2,
        max_context_chunks: int = 25,
        list_max_context_chunks: int = 40,
        rerank_candidates: int = 50,
        hybrid_enabled: bool = True,
        hybrid_text_limit: int = 20,
    ) -> None:
        self._pinecone = pinecone_client
        self._chunk_store = chunk_store
        self._reranker = reranker
        self._top_k = top_k
        self._max_chunks_per_url = max_chunks_per_url
        self._candidate_multiplier = candidate_multiplier
        self._filtered_candidate_multiplier = filtered_candidate_multiplier
        self._section_min_chunks = section_min_chunks
        self._neighbor_radius = neighbor_radius
        self._list_neighbor_radius = list_neighbor_radius
        self._max_context_chunks = max_context_chunks
        self._list_max_context_chunks = list_max_context_chunks
        self._rerank_candidates = rerank_candidates
        self._hybrid_enabled = hybrid_enabled
        self._hybrid_text_limit = hybrid_text_limit

    def retrieve(self, query: str, section: str | None = None) -> RetrievalResult:
        if section:
            candidate_k = max(self._rerank_candidates, self._top_k * self._filtered_candidate_multiplier)
            selected = self._select_matches(query, candidate_k, section)
            if len(selected) < self._section_min_chunks:
                candidate_k = max(self._rerank_candidates, self._top_k * self._candidate_multiplier)
                selected = self._select_matches(query, candidate_k, None)
        else:
            candidate_k = max(self._rerank_candidates, self._top_k * self._candidate_multiplier)
            selected = self._select_matches(query, candidate_k, None)

        expanded = self._expand_neighbors(query, selected)
        return self._build_result(expanded)

    def _select_matches(
        self,
        query: str,
        candidate_k: int,
        section: str | None,
    ) -> list[tuple[Any | None, dict[str, Any]]]:
        vector_k = max(candidate_k, self._rerank_candidates)
        vector_matches = self._pinecone.query(query, vector_k, section=section)
        vector_ids = [match.id for match in vector_matches]

        ranked_lists = [vector_ids]
        if self._hybrid_enabled:
            text_chunks = self._chunk_store.text_search(
                query,
                limit=self._hybrid_text_limit,
                section=section,
            )
            text_ids = [chunk["embedding_id"] for chunk in text_chunks if chunk.get("embedding_id")]
            if text_ids:
                ranked_lists.append(text_ids)

        merged_ids = reciprocal_rank_fusion(ranked_lists)
        chunks_by_id = self._chunk_store.get_by_embedding_ids_map(merged_ids)
        match_by_id = {match.id: match for match in vector_matches}

        candidates: list[tuple[Any | None, dict[str, Any]]] = []
        for embedding_id in merged_ids:
            chunk = chunks_by_id.get(embedding_id)
            if chunk is None:
                continue
            candidates.append((match_by_id.get(embedding_id), chunk))

        rerank_pool = max(self._top_k * 2, self._top_k)
        candidates = self._reranker.rerank_candidates(query, candidates, rerank_pool)

        selected: list[tuple[Any | None, dict[str, Any]]] = []
        source_counts: dict[str, int] = {}

        for match, chunk in candidates:
            source_key = _source_key(match, chunk)
            if source_counts.get(source_key, 0) >= self._max_chunks_per_url:
                continue

            source_counts[source_key] = source_counts.get(source_key, 0) + 1
            selected.append((match, chunk))

            if len(selected) >= self._top_k:
                break

        return selected

    def _expand_neighbors(
        self,
        query: str,
        selected: list[tuple[Any | None, dict[str, Any]]],
    ) -> list[tuple[Any | None, dict[str, Any]]]:
        radius = (
            self._list_neighbor_radius if is_list_intent(query) else self._neighbor_radius
        )
        max_chunks = (
            self._list_max_context_chunks
            if is_list_intent(query)
            else self._max_context_chunks
        )

        if radius < 1:
            return selected[:max_chunks]

        seen_ids: set[str] = set()
        expanded: list[tuple[Any | None, dict[str, Any]]] = []
        neighbor_ids_to_fetch: set[str] = set()

        for match, chunk in selected:
            embedding_id = _embedding_id(match, chunk)
            if embedding_id not in seen_ids:
                seen_ids.add(embedding_id)
                expanded.append((match, chunk))
            for neighbor_id in neighbor_chunk_ids(embedding_id, radius):
                if neighbor_id not in seen_ids:
                    neighbor_ids_to_fetch.add(neighbor_id)

        neighbors_by_id = self._chunk_store.get_by_embedding_ids_map(
            list(neighbor_ids_to_fetch)
        )

        for neighbor_id in sorted(
            neighbor_ids_to_fetch,
            key=lambda value: parse_chunk_id(value) or ("", -1),
        ):
            if len(expanded) >= max_chunks:
                break
            chunk = neighbors_by_id.get(neighbor_id)
            if chunk is None:
                continue
            if neighbor_id in seen_ids:
                continue
            seen_ids.add(neighbor_id)
            expanded.append((None, chunk))

        return _sort_chunks_for_context(expanded[:max_chunks])

    def _build_result(
        self, selected: list[tuple[Any | None, dict[str, Any]]]
    ) -> RetrievalResult:
        parts: list[str] = []
        sources: list[Source] = []
        seen_urls: set[str] = set()

        for index, (match, chunk) in enumerate(selected, start=1):
            meta = _merge_metadata(match, chunk)
            title = meta.get("title") or "unknown"
            url = meta.get("url") or ""
            section = meta.get("section") or "unknown"
            text = chunk.get("text", "")

            parts.append(
                f"Source {index}: {title}\n"
                f"URL: {url or 'unknown'}\n"
                f"Section: {section}\n"
                f"Content:\n{text}"
            )

            if url and url not in seen_urls:
                seen_urls.add(url)
                sources.append(Source(title=title, url=url))

        context = "\n\n---\n\n".join(parts) if parts else "No relevant context was found."
        return RetrievalResult(context=context, sources=sources)


def _embedding_id(match: Any | None, chunk: dict[str, Any]) -> str:
    return chunk.get("embedding_id") or (match.id if match is not None else "")


def _sort_chunks_for_context(
    items: list[tuple[Any | None, dict[str, Any]]],
) -> list[tuple[Any | None, dict[str, Any]]]:
    def sort_key(item: tuple[Any | None, dict[str, Any]]) -> tuple[int, str, int, int]:
        match, chunk = item
        embedding_id = _embedding_id(match, chunk)
        parsed = parse_chunk_id(embedding_id)
        is_hit = 0 if match is not None else 1
        if parsed is None:
            return (is_hit, embedding_id, 0, 0)
        filename, chunk_number = parsed
        return (is_hit, filename, chunk_number, 0)

    return sorted(items, key=sort_key)


def _merge_metadata(match: Any | None, chunk: dict[str, Any]) -> dict[str, Any]:
    mongo_metadata = chunk.get("metadata") or {}
    if match is None:
        return {
            "title": mongo_metadata.get("title"),
            "url": mongo_metadata.get("url"),
            "section": mongo_metadata.get("section"),
        }

    pinecone_metadata = getattr(match, "metadata", None) or {}
    return {
        "title": pinecone_metadata.get("title") or mongo_metadata.get("title"),
        "url": pinecone_metadata.get("url") or mongo_metadata.get("url"),
        "section": pinecone_metadata.get("section") or mongo_metadata.get("section"),
    }


def _source_key(match: Any | None, chunk: dict[str, Any]) -> str:
    meta = _merge_metadata(match, chunk)
    return meta.get("url") or chunk.get("embedding_id") or (match.id if match else "")
