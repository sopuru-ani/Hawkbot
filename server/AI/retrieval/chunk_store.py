import logging

from pymongo import MongoClient
from pymongo.errors import OperationFailure

logger = logging.getLogger(__name__)


class ChunkStore:
    def __init__(self, uri: str, db_name: str, collection_name: str) -> None:
        client = MongoClient(uri)
        self._collection = client[db_name][collection_name]
        self._text_index_ready = False

    def get_by_embedding_ids(self, embedding_ids: list[str]) -> list[dict]:
        if not embedding_ids:
            return []

        by_id = self.get_by_embedding_ids_map(embedding_ids)
        return [by_id[eid] for eid in embedding_ids if eid in by_id]

    def get_by_embedding_ids_map(self, embedding_ids: list[str]) -> dict[str, dict]:
        if not embedding_ids:
            return {}

        cursor = self._collection.find({"embedding_id": {"$in": embedding_ids}})
        return {doc["embedding_id"]: doc for doc in cursor}

    def ensure_text_index(self) -> bool:
        if self._text_index_ready:
            return True

        try:
            existing = self._collection.index_information()
            if "text_search" not in existing:
                self._collection.create_index([("text", "text")], name="text_search")
            self._text_index_ready = True
            return True
        except OperationFailure as exc:
            logger.warning("MongoDB text index unavailable: %s", exc)
            return False

    def text_search(
        self,
        query: str,
        limit: int = 20,
        section: str | None = None,
    ) -> list[dict]:
        if not query.strip() or not self.ensure_text_index():
            return []

        filter_doc: dict = {"$text": {"$search": query}}
        if section:
            filter_doc["metadata.section"] = section

        try:
            cursor = (
                self._collection.find(
                    filter_doc,
                    {
                        "score": {"$meta": "textScore"},
                        "embedding_id": 1,
                        "text": 1,
                        "metadata": 1,
                    },
                )
                .sort([("score", {"$meta": "textScore"})])
                .limit(limit)
            )
            return list(cursor)
        except OperationFailure as exc:
            logger.warning("MongoDB text search failed: %s", exc)
            return []
