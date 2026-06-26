from functools import lru_cache

from AI.providers.gemini import GeminiProvider
from AI.retrieval.chunk_store import ChunkStore
from AI.retrieval.pinecone_client import PineconeClient
from AI.retrieval.retriever import Retriever
from AI.services.chatbot import ChatbotService
from AI.services.classifier import QueryClassifier
from config import get_settings


@lru_cache
def get_chatbot_service() -> ChatbotService:
    settings = get_settings()
    llm = GeminiProvider(api_key=settings.gemini_api_key, model=settings.gemini_model)
    pinecone = PineconeClient(
        api_key=settings.pinecone_api_key,
        index_name=settings.pinecone_index_name,
        embedding_model_name=settings.sentence_transformer_model,
    )
    chunk_store = ChunkStore(
        uri=settings.mongodb_uri,
        db_name=settings.mongodb_db,
        collection_name=settings.mongodb_collection,
    )
    retriever = Retriever(
        pinecone_client=pinecone,
        chunk_store=chunk_store,
        top_k=settings.retrieval_top_k,
    )
    classifier = QueryClassifier(llm=llm)
    return ChatbotService(llm=llm, retriever=retriever, classifier=classifier)
