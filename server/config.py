import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    gemini_api_key: str
    gemini_model: str
    pinecone_api_key: str
    pinecone_index_name: str
    sentence_transformer_model: str
    mongodb_uri: str
    mongodb_db: str
    mongodb_collection: str
    retrieval_top_k: int


def get_settings() -> Settings:
    return Settings(
        gemini_api_key=os.environ["GEMINI_API_KEY"],
        gemini_model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        pinecone_api_key=os.environ["PINECONE_API_KEY"],
        pinecone_index_name=os.environ["PINECONE_INDEX_NAME"],
        sentence_transformer_model=os.environ["SENTENCE_TRANSFORMER_MODEL"],
        mongodb_uri=os.environ["MONGODB_URI"],
        mongodb_db=os.environ["MONGODB_DB"],
        mongodb_collection=os.environ["MONGODB_COLLECTION"],
        retrieval_top_k=int(os.getenv("RETRIEVAL_TOP_K", "5")),
    )
