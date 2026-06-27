from typing import Any

from pinecone import Pinecone
from sentence_transformers import SentenceTransformer


class PineconeClient:
    def __init__(
        self,
        api_key: str,
        index_name: str,
        embedding_model_name: str,
    ) -> None:
        self._model = SentenceTransformer(embedding_model_name)
        pc = Pinecone(api_key=api_key)
        self._index = pc.Index(index_name)

    def query(self, query_text: str, top_k: int, section: str | None = None):
        query_kwargs: dict[str, Any] = {
            "vector": self._model.encode(query_text).tolist(),
            "top_k": top_k,
            "include_metadata": True,
        }
        if section:
            query_kwargs["filter"] = {"section": {"$eq": section}}

        response = self._index.query(**query_kwargs)
        return response.matches
