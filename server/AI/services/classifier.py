from AI.providers.base import LLMProvider, Message
from AI.services.prompts import CLASSIFIER_SYSTEM


class QueryClassifier:
    def __init__(self, llm: LLMProvider) -> None:
        self._llm = llm

    def classify(self, messages: list[Message]) -> str:
        latest = messages[-1].content.strip()
        if len(messages) == 1:
            content = (
                "Is the following user message about UMES?\n\n"
                f"Latest user message:\n{latest}\n\n"
                "Reply with exactly one word: umes or general."
            )
        else:
            transcript = self._format_transcript(messages)
            content = (
                "Classify the latest user message in this conversation.\n\n"
                f"{transcript}\n\n"
                "Is the latest user message about UMES? Use the conversation to "
                "resolve references in follow-ups like 'them', 'that', or 'those'. "
                "Reply with exactly one word: umes or general."
            )
        classification_messages = [Message(role="user", content=content)]
        result = self._llm.generate(
            classification_messages, system=CLASSIFIER_SYSTEM
        ).strip().lower()
        label = result.split()[0] if result else "general"
        return "umes" if label == "umes" else "general"

    def _format_transcript(self, messages: list[Message]) -> str:
        lines: list[str] = []
        for message in messages:
            speaker = "User" if message.role == "user" else "Assistant"
            lines.append(f"{speaker}: {message.content}")
        return "\n".join(lines)
