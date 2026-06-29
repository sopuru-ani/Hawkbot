from datetime import datetime, timezone

from bson import ObjectId
from pymongo import ASCENDING, DESCENDING, MongoClient

DEFAULT_TITLE = "New chat"
DEFAULT_TITLES = frozenset({DEFAULT_TITLE, "Untitled"})


class ChatSessionStore:
    def __init__(self, uri: str, db_name: str, collection_name: str) -> None:
        client = MongoClient(uri)
        self._collection = client[db_name][collection_name]
        self._indexes_ready = False

    def ensure_indexes(self) -> None:
        if self._indexes_ready:
            return

        self._collection.create_index(
            [("user_id", ASCENDING), ("updated_at", DESCENDING)]
        )
        self._indexes_ready = True

    def list_sessions(self, user_id: str) -> list[dict]:
        self.ensure_indexes()
        cursor = self._collection.find(
            {"user_id": ObjectId(user_id)},
            {"title": 1, "updated_at": 1},
        ).sort("updated_at", DESCENDING)

        return [
            {
                "id": str(doc["_id"]),
                "title": doc.get("title", DEFAULT_TITLE),
                "updated_at": doc["updated_at"],
            }
            for doc in cursor
        ]

    def create_session(self, user_id: str, title: str = DEFAULT_TITLE) -> dict:
        self.ensure_indexes()
        now = datetime.now(timezone.utc)
        doc = {
            "user_id": ObjectId(user_id),
            "title": title,
            "messages": [],
            "created_at": now,
            "updated_at": now,
        }
        result = self._collection.insert_one(doc)
        return self._session_summary(result.inserted_id, doc)

    def get_session(self, user_id: str, session_id: str) -> dict | None:
        self.ensure_indexes()
        doc = self._collection.find_one(
            {"_id": ObjectId(session_id), "user_id": ObjectId(user_id)}
        )
        if not doc:
            return None
        return self._session_detail(doc)

    def delete_session(self, user_id: str, session_id: str) -> bool:
        self.ensure_indexes()
        result = self._collection.delete_one(
            {"_id": ObjectId(session_id), "user_id": ObjectId(user_id)}
        )
        return result.deleted_count > 0

    def append_messages(
        self,
        user_id: str,
        session_id: str,
        messages: list[dict],
    ) -> bool:
        self.ensure_indexes()
        now = datetime.now(timezone.utc)
        result = self._collection.update_one(
            {"_id": ObjectId(session_id), "user_id": ObjectId(user_id)},
            {
                "$push": {"messages": {"$each": messages}},
                "$set": {"updated_at": now},
            },
        )
        return result.modified_count > 0

    def set_title(self, user_id: str, session_id: str, title: str) -> bool:
        self.ensure_indexes()
        now = datetime.now(timezone.utc)
        result = self._collection.update_one(
            {"_id": ObjectId(session_id), "user_id": ObjectId(user_id)},
            {"$set": {"title": title, "updated_at": now}},
        )
        return result.modified_count > 0

    def has_default_title(self, user_id: str, session_id: str) -> bool:
        self.ensure_indexes()
        doc = self._collection.find_one(
            {"_id": ObjectId(session_id), "user_id": ObjectId(user_id)},
            {"title": 1},
        )
        if not doc:
            return False
        return doc.get("title", DEFAULT_TITLE) in DEFAULT_TITLES

    @staticmethod
    def _session_summary(session_id: ObjectId, doc: dict) -> dict:
        return {
            "id": str(session_id),
            "title": doc.get("title", DEFAULT_TITLE),
            "updated_at": doc["updated_at"],
        }

    @staticmethod
    def _session_detail(doc: dict) -> dict:
        messages = []
        for message in doc.get("messages", []):
            entry = {
                "role": message["role"],
                "content": message["content"],
                "created_at": message.get("created_at", doc["created_at"]),
            }
            if message.get("mode"):
                entry["mode"] = message["mode"]
            if message.get("sources"):
                entry["sources"] = message["sources"]
            messages.append(entry)

        return {
            "id": str(doc["_id"]),
            "title": doc.get("title", DEFAULT_TITLE),
            "messages": messages,
            "created_at": doc["created_at"],
            "updated_at": doc["updated_at"],
        }
