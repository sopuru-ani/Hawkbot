from AI.providers.base import LLMProvider, Message
from AI.services.prompts import WEB_SEARCH_GATE_SYSTEM


class WebSearchGate:
    def __init__(self, llm: LLMProvider) -> None:
        self._llm = llm

    def needs_web_search(self, messages: list[Message]) -> bool:
        transcript = self._format_transcript(messages)
        result = self._llm.generate(
            [
                Message(
                    role="user",
                    content=(
                        "Does this conversation need live web search to answer well?\n\n"
                        f"{transcript}\n\n"
                        "Reply with exactly one word: yes or no."
                    ),
                )
            ],
            system=WEB_SEARCH_GATE_SYSTEM,
        ).strip().lower()
        return result.startswith("yes")

    def _format_transcript(self, messages: list[Message]) -> str:
        lines: list[str] = []
        for message in messages:
            speaker = "User" if message.role == "user" else "Assistant"
            lines.append(f"{speaker}: {message.content}")
        return "\n".join(lines)
