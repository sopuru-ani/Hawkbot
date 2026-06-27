import logging
import secrets
from datetime import datetime, timedelta, timezone

from bson import ObjectId
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError

from auth.passwords import hash_password, verify_password

logger = logging.getLogger(__name__)


class AuthStore:
    def __init__(
        self,
        uri: str,
        db_name: str,
        users_collection: str,
        sessions_collection: str,
        session_ttl_days: int,
    ) -> None:
        client = MongoClient(uri)
        db = client[db_name]
        self._users = db[users_collection]
        self._sessions = db[sessions_collection]
        self._session_ttl_days = session_ttl_days
        self._indexes_ready = False

    def ensure_indexes(self) -> None:
        if self._indexes_ready:
            return

        self._users.create_index("email", unique=True)
        self._sessions.create_index("session_id", unique=True)
        self._sessions.create_index("expires_at", expireAfterSeconds=0)
        self._indexes_ready = True

    def register(
        self,
        email: str,
        password: str,
        display_name: str | None = None,
    ) -> dict:
        self.ensure_indexes()
        normalized_email = email.strip().lower()
        password_hash = hash_password(password)
        now = datetime.now(timezone.utc)
        doc = {
            "email": normalized_email,
            "password_hash": password_hash,
            "display_name": display_name.strip() if display_name else None,
            "created_at": now,
        }

        try:
            result = self._users.insert_one(doc)
        except DuplicateKeyError as exc:
            raise ValueError("email_taken") from exc

        return self._user_doc(result.inserted_id, doc)

    def authenticate(self, email: str, password: str) -> dict | None:
        self.ensure_indexes()
        normalized_email = email.strip().lower()
        doc = self._users.find_one({"email": normalized_email})
        if not doc or not verify_password(password, doc["password_hash"]):
            return None
        return self._user_doc(doc["_id"], doc)

    def create_session(self, user_id: str) -> str:
        self.ensure_indexes()
        session_id = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(days=self._session_ttl_days)
        self._sessions.insert_one(
            {
                "session_id": session_id,
                "user_id": ObjectId(user_id),
                "expires_at": expires_at,
            }
        )
        return session_id

    def delete_session(self, session_id: str) -> None:
        self._sessions.delete_one({"session_id": session_id})

    def get_user_by_session(self, session_id: str) -> dict | None:
        self.ensure_indexes()
        now = datetime.now(timezone.utc)
        session = self._sessions.find_one(
            {"session_id": session_id, "expires_at": {"$gt": now}}
        )
        if not session:
            return None

        doc = self._users.find_one({"_id": session["user_id"]})
        if not doc:
            return None

        return self._user_doc(doc["_id"], doc)

    @staticmethod
    def _user_doc(user_id: ObjectId, doc: dict) -> dict:
        return {
            "id": str(user_id),
            "email": doc["email"],
            "display_name": doc.get("display_name"),
        }
