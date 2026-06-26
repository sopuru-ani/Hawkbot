import json
from collections.abc import Iterator

from AI.providers.base import LLMProvider, Message
from AI.retrieval.retriever import Retriever, Source
from AI.services.classifier import QueryClassifier
from AI.services.prompts import GENERAL_SYSTEM, RAG_SYSTEM


class ChatbotService:
    def __init__(
        self,
        llm: LLMProvider,
        retriever: Retriever,
        classifier: QueryClassifier,
    ) -> None:
        self._llm = llm
        self._retriever = retriever
        self._classifier = classifier

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

            if mode == "umes":
                yield _status("retrieving", "Searching UMES sources...")
                retrieval = self._retriever.retrieve(messages[-1].content)
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
                yield _status("general", "Answering your question...")

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


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _status(stage: str, message: str) -> str:
    return _sse("status", {"stage": stage, "message": message})
