from functools import lru_cache

from fastapi import Depends, HTTPException, Request, status

from AI.providers.openai import OpenAICompatibleProvider
from AI.retrieval.chunk_store import ChunkStore
from AI.retrieval.pinecone_client import PineconeClient
from AI.retrieval.reranker import CrossEncoderReranker, NoOpReranker
from AI.retrieval.retriever import Retriever
from AI.retrieval.web_search import TavilyWebSearch
from AI.services.classifier import QueryClassifier
from AI.services.query_rewriter import QueryRewriter
from AI.services.section_router import SectionRouter
from AI.services.title_generator import TitleGenerator
from AI.services.umes_retrieval_gate import UmesRetrievalGate
from AI.services.web_query_rewriter import WebQueryRewriter
from AI.services.web_search_gate import WebSearchGate
from AI.services.chatbot import ChatbotService
from auth.store import AuthStore
from chat_sessions.store import ChatSessionStore
from config import Settings, get_settings
from schemas.auth import UserResponse


@lru_cache
def get_chatbot_service() -> ChatbotService:
    settings = get_settings()
    llm = OpenAICompatibleProvider(
        api_key=settings.openai_api_key,
        base_url=settings.openai_base_url,
        model=settings.llm_model,
    )
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
    chunk_store.ensure_text_index()
    reranker = (
        CrossEncoderReranker(settings.retrieval_rerank_model)
        if settings.retrieval_rerank_enabled
        else NoOpReranker()
    )
    retriever = Retriever(
        pinecone_client=pinecone,
        chunk_store=chunk_store,
        reranker=reranker,
        top_k=settings.retrieval_top_k,
        max_chunks_per_url=settings.retrieval_max_chunks_per_url,
        section_min_chunks=settings.retrieval_section_min_chunks,
        neighbor_radius=settings.retrieval_neighbor_radius,
        list_neighbor_radius=settings.retrieval_list_neighbor_radius,
        max_context_chunks=settings.retrieval_max_context_chunks,
        list_max_context_chunks=settings.retrieval_list_max_context_chunks,
        rerank_candidates=settings.retrieval_rerank_candidates,
        hybrid_enabled=settings.retrieval_hybrid_enabled,
        hybrid_text_limit=settings.retrieval_hybrid_text_limit,
    )
    classifier = QueryClassifier(llm=llm)
    query_rewriter = QueryRewriter(llm=llm)
    section_router = SectionRouter(llm=llm)
    web_search = TavilyWebSearch(
        api_key=settings.tavily_api_key,
        max_results=settings.tavily_max_results,
    )
    web_search_gate = WebSearchGate(llm=llm)
    web_query_rewriter = WebQueryRewriter(llm=llm)
    umes_retrieval_gate = UmesRetrievalGate(llm=llm)
    return ChatbotService(
        llm=llm,
        retriever=retriever,
        classifier=classifier,
        query_rewriter=query_rewriter,
        section_router=section_router,
        web_search=web_search,
        web_search_gate=web_search_gate,
        web_query_rewriter=web_query_rewriter,
        umes_retrieval_gate=umes_retrieval_gate,
    )


@lru_cache
def get_title_generator() -> TitleGenerator:
    settings = get_settings()
    llm = OpenAICompatibleProvider(
        api_key=settings.openai_api_key,
        base_url=settings.openai_base_url,
        model=settings.llm_model,
    )
    return TitleGenerator(llm=llm)


@lru_cache
def get_chat_session_store() -> ChatSessionStore:
    settings = get_settings()
    store = ChatSessionStore(
        uri=settings.mongodb_uri,
        db_name=settings.mongodb_db,
        collection_name=settings.mongodb_chat_sessions_collection,
    )
    store.ensure_indexes()
    return store


@lru_cache
def get_auth_store() -> AuthStore:
    settings = get_settings()
    store = AuthStore(
        uri=settings.mongodb_uri,
        db_name=settings.mongodb_db,
        users_collection=settings.mongodb_users_collection,
        sessions_collection=settings.mongodb_sessions_collection,
        session_ttl_days=settings.session_ttl_days,
    )
    store.ensure_indexes()
    return store


def get_current_user(
    request: Request,
    store: AuthStore = Depends(get_auth_store),
    settings: Settings = Depends(get_settings),
) -> UserResponse:
    session_id = request.cookies.get(settings.session_cookie_name)
    if not session_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    user = store.get_user_by_session(session_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    return UserResponse(**user)
