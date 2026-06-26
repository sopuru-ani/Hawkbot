from AI.providers.base import LLMProvider, Message
from AI.services.prompts import CLASSIFIER_SYSTEM


class QueryClassifier:
    def __init__(self, llm: LLMProvider) -> None:
        self._llm = llm

    def classify(self, messages: list[Message]) -> str:
        transcript = self._format_transcript(messages)
        classification_messages = [
            Message(
                role="user",
                content=(
                    "Classify the following conversation.\n\n"
                    f"{transcript}\n\n"
                    "Is this about UMES? Reply with exactly one word: umes or general."
                ),
            )
        ]
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
