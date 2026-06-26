from dataclasses import dataclass


@dataclass(frozen=True)
class Source:
    title: str
    url: str


@dataclass(frozen=True)
class RetrievalResult:
    context: str
    sources: list[Source]


class Retriever:
    def __init__(self, pinecone_client, chunk_store, top_k: int) -> None:
        self._pinecone = pinecone_client
        self._chunk_store = chunk_store
        self._top_k = top_k

    def retrieve(self, query: str) -> RetrievalResult:
        matches = self._pinecone.query(query, self._top_k)
        embedding_ids = [match.id for match in matches]
        chunks = self._chunk_store.get_by_embedding_ids(embedding_ids)

        parts: list[str] = []
        sources: list[Source] = []
        seen_urls: set[str] = set()

        for chunk in chunks:
            meta = chunk.get("metadata", {})
            title = meta.get("title", "unknown")
            url = meta.get("url", "")
            text = chunk.get("text", "")
            parts.append(f"Source: {title} ({url})\n{text}")

            if url and url not in seen_urls:
                seen_urls.add(url)
                sources.append(Source(title=title, url=url))

        context = "\n\n---\n\n".join(parts)
        return RetrievalResult(context=context, sources=sources)
