import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()

NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1"
DEFAULT_NVIDIA_MODEL = "meta/llama-3.3-70b-instruct"

DEFAULT_CORS_ORIGINS = (
    "http://localhost:5173,"
    "http://192.168.1.9:5173"
)


def get_cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", DEFAULT_CORS_ORIGINS)
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


@dataclass(frozen=True)
class Settings:
    openai_api_key: str
    openai_base_url: str
    llm_model: str
    pinecone_api_key: str
    pinecone_index_name: str
    sentence_transformer_model: str
    mongodb_uri: str
    mongodb_db: str
    mongodb_collection: str
    retrieval_top_k: int
    retrieval_max_chunks_per_url: int
    retrieval_section_min_chunks: int
    retrieval_neighbor_radius: int
    retrieval_list_neighbor_radius: int
    retrieval_max_context_chunks: int
    retrieval_list_max_context_chunks: int
    retrieval_rerank_enabled: bool
    retrieval_rerank_model: str
    retrieval_rerank_candidates: int
    retrieval_hybrid_enabled: bool
    retrieval_hybrid_text_limit: int
    session_secret: str
    session_cookie_name: str
    session_ttl_days: int
    cookie_secure: bool
    mongodb_users_collection: str
    mongodb_sessions_collection: str
    mongodb_chat_sessions_collection: str


def get_settings() -> Settings:
    return Settings(
        openai_api_key=os.getenv("OPENAI_API_KEY", "nvapi-placeholder"),
        openai_base_url=os.getenv("OPENAI_BASE_URL", NVIDIA_BASE_URL),
        llm_model=os.getenv("LLM_MODEL", DEFAULT_NVIDIA_MODEL),
        pinecone_api_key=os.environ["PINECONE_API_KEY"],
        pinecone_index_name=os.environ["PINECONE_INDEX_NAME"],
        sentence_transformer_model=os.environ["SENTENCE_TRANSFORMER_MODEL"],
        mongodb_uri=os.environ["MONGODB_URI"],
        mongodb_db=os.environ["MONGODB_DB"],
        mongodb_collection=os.environ["MONGODB_COLLECTION"],
        retrieval_top_k=int(os.getenv("RETRIEVAL_TOP_K", "15")),
        retrieval_max_chunks_per_url=int(os.getenv("RETRIEVAL_MAX_CHUNKS_PER_URL", "4")),
        retrieval_section_min_chunks=int(os.getenv("RETRIEVAL_SECTION_MIN_CHUNKS", "5")),
        retrieval_neighbor_radius=int(os.getenv("RETRIEVAL_NEIGHBOR_RADIUS", "1")),
        retrieval_list_neighbor_radius=int(os.getenv("RETRIEVAL_LIST_NEIGHBOR_RADIUS", "2")),
        retrieval_max_context_chunks=int(os.getenv("RETRIEVAL_MAX_CONTEXT_CHUNKS", "25")),
        retrieval_list_max_context_chunks=int(
            os.getenv("RETRIEVAL_LIST_MAX_CONTEXT_CHUNKS", "40")
        ),
        retrieval_rerank_enabled=os.getenv("RETRIEVAL_RERANK_ENABLED", "true").lower()
        == "true",
        retrieval_rerank_model=os.getenv(
            "RETRIEVAL_RERANK_MODEL", "cross-encoder/ms-marco-MiniLM-L-6-v2"
        ),
        retrieval_rerank_candidates=int(os.getenv("RETRIEVAL_RERANK_CANDIDATES", "50")),
        retrieval_hybrid_enabled=os.getenv("RETRIEVAL_HYBRID_ENABLED", "true").lower()
        == "true",
        retrieval_hybrid_text_limit=int(os.getenv("RETRIEVAL_HYBRID_TEXT_LIMIT", "20")),
        session_secret=os.getenv("SESSION_SECRET", "dev-session-secret-change-me"),
        session_cookie_name=os.getenv("SESSION_COOKIE_NAME", "session_id"),
        session_ttl_days=int(os.getenv("SESSION_TTL_DAYS", "30")),
        cookie_secure=os.getenv("COOKIE_SECURE", "false").lower() == "true",
        mongodb_users_collection=os.getenv("MONGODB_USERS_COLLECTION", "users"),
        mongodb_sessions_collection=os.getenv("MONGODB_SESSIONS_COLLECTION", "sessions"),
        mongodb_chat_sessions_collection=os.getenv(
            "MONGODB_CHAT_SESSIONS_COLLECTION", "chat_sessions"
        ),
    )
