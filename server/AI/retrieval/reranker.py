from typing import Any


class CrossEncoderReranker:
    def __init__(self, model_name: str) -> None:
        self._model_name = model_name
        self._model = None

    @property
    def model(self):
        if self._model is None:
            from sentence_transformers import CrossEncoder

            self._model = CrossEncoder(self._model_name)
        return self._model

    def rerank_candidates(
        self,
        query: str,
        candidates: list[tuple[Any | None, dict[str, Any]]],
        limit: int,
    ) -> list[tuple[Any | None, dict[str, Any]]]:
        if not candidates:
            return []

        pairs = [(query, chunk.get("text", "")) for _, chunk in candidates]
        scores = self.model.predict(pairs)
        ranked = sorted(
            zip(candidates, scores),
            key=lambda item: float(item[1]),
            reverse=True,
        )
        return [item[0] for item in ranked[:limit]]


class NoOpReranker:
    def rerank_candidates(
        self,
        query: str,
        candidates: list[tuple[Any | None, dict[str, Any]]],
        limit: int,
    ) -> list[tuple[Any | None, dict[str, Any]]]:
        return candidates[:limit]
