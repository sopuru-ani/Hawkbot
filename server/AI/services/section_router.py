from AI.providers.base import LLMProvider, Message
from AI.retrieval.metadata import UMES_SECTIONS, SECTION_DESCRIPTIONS, VALID_SECTION_SET
from AI.services.prompts import SECTION_ROUTER_SYSTEM


class SectionRouter:
    def __init__(self, llm: LLMProvider) -> None:
        self._llm = llm

    def route(self, messages: list[Message], search_query: str) -> str | None:
        transcript = self._format_transcript(messages)
        section_list = ", ".join(UMES_SECTIONS)
        routing_messages = [
            Message(
                role="user",
                content=(
                    "Choose the single best UMES knowledge-base section for retrieval.\n\n"
                    f"Sections: {section_list}\n\n"
                    f"Section guide:\n{SECTION_DESCRIPTIONS}\n\n"
                    f"Conversation:\n{transcript}\n\n"
                    f"Search query: {search_query}\n\n"
                    "Reply with exactly one section name from the list, or none if unclear."
                ),
            )
        ]
        result = self._llm.generate(
            routing_messages, system=SECTION_ROUTER_SYSTEM
        ).strip().lower()
        label = result.split()[0] if result else "none"
        if label == "none":
            return None
        return label if label in VALID_SECTION_SET else None

    def _format_transcript(self, messages: list[Message]) -> str:
        lines: list[str] = []
        for message in messages:
            speaker = "User" if message.role == "user" else "Assistant"
            lines.append(f"{speaker}: {message.content}")
        return "\n".join(lines)
