from pymongo import MongoClient


class ChunkStore:
    def __init__(self, uri: str, db_name: str, collection_name: str) -> None:
        client = MongoClient(uri)
        self._collection = client[db_name][collection_name]

    def get_by_embedding_ids(self, embedding_ids: list[str]) -> list[dict]:
        if not embedding_ids:
            return []

        cursor = self._collection.find({"embedding_id": {"$in": embedding_ids}})
        by_id = {doc["embedding_id"]: doc for doc in cursor}
        return [by_id[eid] for eid in embedding_ids if eid in by_id]
