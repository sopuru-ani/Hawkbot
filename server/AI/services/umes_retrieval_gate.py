from AI.providers.base import LLMProvider, Message
from AI.services.prompts import UMES_RETRIEVAL_GATE_SYSTEM


class UmesRetrievalGate:
    def __init__(self, llm: LLMProvider) -> None:
        self._llm = llm

    def needs_retrieval(self, messages: list[Message]) -> bool:
        latest = messages[-1].content.strip()
        if len(messages) == 1:
            prompt = (
                "Does this user message require searching the UMES knowledge base?\n\n"
                f"Latest user message:\n{latest}\n\n"
                "Reply with exactly one word: yes or no."
            )
        else:
            transcript = self._format_transcript(messages)
            prompt = (
                "Does the latest user message require searching the UMES knowledge "
                "base to answer well?\n\n"
                f"Conversation:\n{transcript}\n\n"
                "Reply with exactly one word: yes or no."
            )

        result = self._llm.generate(
            [Message(role="user", content=prompt)],
            system=UMES_RETRIEVAL_GATE_SYSTEM,
        ).strip().lower()
        return result.startswith("yes")

    def _format_transcript(self, messages: list[Message]) -> str:
        lines: list[str] = []
        for message in messages:
            speaker = "User" if message.role == "user" else "Assistant"
            lines.append(f"{speaker}: {message.content}")
        return "\n".join(lines)
