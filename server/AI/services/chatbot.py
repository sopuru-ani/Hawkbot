import json
from collections.abc import Iterator
from dataclasses import dataclass

from AI.providers.base import LLMProvider, Message
from AI.retrieval.retriever import Retriever, Source
from AI.retrieval.web_search import TavilyWebSearch, extract_urls
from AI.services.classifier import QueryClassifier
from AI.services.prompts import (
    GENERAL_SYSTEM,
    RAG_SYSTEM,
    WEB_EXTRACT_SYSTEM,
    WEB_SEARCH_SYSTEM,
)
from AI.services.query_rewriter import QueryRewriter
from AI.services.section_router import SectionRouter
from AI.services.web_query_rewriter import WebQueryRewriter
from AI.services.umes_retrieval_gate import UmesRetrievalGate
from AI.services.web_search_gate import WebSearchGate


@dataclass(frozen=True)
class _WebContext:
    status_message: str
    label: str
    text: str
    sources: list[Source]
    system: str


class ChatbotService:
    def __init__(
        self,
        llm: LLMProvider,
        retriever: Retriever,
        classifier: QueryClassifier,
        query_rewriter: QueryRewriter,
        section_router: SectionRouter,
        web_search: TavilyWebSearch,
        web_search_gate: WebSearchGate,
        web_query_rewriter: WebQueryRewriter,
        umes_retrieval_gate: UmesRetrievalGate,
    ) -> None:
        self._llm = llm
        self._retriever = retriever
        self._classifier = classifier
        self._query_rewriter = query_rewriter
        self._section_router = section_router
        self._web_search = web_search
        self._web_search_gate = web_search_gate
        self._web_query_rewriter = web_query_rewriter
        self._umes_retrieval_gate = umes_retrieval_gate

    def stream_chat(self, messages: list[Message]) -> Iterator[str]:
        if not messages or messages[-1].role != "user":
            yield _sse("error", {"message": "Last message must be from the user."})
            return

        try:
            yield _status("classifying", "Understanding your question...")

            mode = self._classifier.classify(messages)
            sources: list[Source] = []
            system = GENERAL_SYSTEM
            generation_messages = list(messages)

            if mode == "umes" and self._umes_retrieval_gate.needs_retrieval(messages):
                yield _status("retrieving", "Searching UMES sources...")
                search_query = self._query_rewriter.rewrite(messages)
                section = self._section_router.route(messages, search_query)
                retrieval = self._retriever.retrieve(search_query, section=section)
                sources = retrieval.sources
                system = RAG_SYSTEM
                generation_messages = [
                    *messages[:-1],
                    Message(
                        role="user",
                        content=(
                            f"{messages[-1].content}\n\n"
                            "Use the following UMES context to answer:\n\n"
                            f"{retrieval.context}"
                        ),
                    ),
                ]
            else:
                web_context = self._try_web_context(messages)
                if web_context is not None:
                    yield _status("searching_web", web_context.status_message)
                else:
                    yield _status("general", "Answering your question...")

                mode, sources, system, generation_messages = self._fill_general_response(
                    messages, mode, web_context
                )

            yield _status("generating", "Writing response...")

            for token in self._llm.generate_stream(
                generation_messages, system=system
            ):
                yield _sse("token", {"text": token})

            yield _sse(
                "done",
                {
                    "mode": mode,
                    "sources": [
                        {"title": source.title, "url": source.url}
                        for source in sources
                    ],
                },
            )
        except Exception as exc:
            yield _sse("error", {"message": str(exc)})

    def _fill_general_response(
        self,
        messages: list[Message],
        mode: str,
        web_context: _WebContext | None,
    ) -> tuple[str, list[Source], str, list[Message]]:
        sources: list[Source] = []
        system = GENERAL_SYSTEM
        generation_messages = list(messages)

        if web_context is not None:
            sources = web_context.sources
            system = web_context.system
            generation_messages = [
                *messages[:-1],
                Message(
                    role="user",
                    content=(
                        f"{messages[-1].content}\n\n"
                        f"{web_context.label}\n\n"
                        f"{web_context.text}"
                    ),
                ),
            ]
        else:
            mode = "general"

        return mode, sources, system, generation_messages

    def _try_web_context(self, messages: list[Message]) -> _WebContext | None:
        urls = extract_urls(messages[-1].content)
        if urls:
            return self._extract_url_context(messages, urls)

        if not self._web_search_gate.needs_web_search(messages):
            return None

        search_query = self._web_query_rewriter.rewrite(messages)
        try:
            result = self._web_search.search(search_query)
        except Exception:
            return None

        if not result.context.strip():
            return None

        return _WebContext(
            status_message="Searching the web...",
            label="Use the following web search results to answer:",
            text=result.context,
            sources=result.sources,
            system=WEB_SEARCH_SYSTEM,
        )

    def _extract_url_context(
        self, messages: list[Message], urls: list[str]
    ) -> _WebContext | None:
        extract_query = _message_without_urls(messages[-1].content, urls)
        try:
            result = self._web_search.extract_urls(
                urls, query=extract_query or None
            )
        except Exception:
            return None

        return _WebContext(
            status_message="Reading linked pages...",
            label="Use the following extracted web page content to answer:",
            text=result.context,
            sources=result.sources,
            system=WEB_EXTRACT_SYSTEM,
        )


def _message_without_urls(content: str, urls: list[str]) -> str:
    text = content
    for url in urls:
        text = text.replace(url, "")
    cleaned = " ".join(text.split()).strip()
    return cleaned or "Summarize this page."


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _status(stage: str, message: str) -> str:
    return _sse("status", {"stage": stage, "message": message})
