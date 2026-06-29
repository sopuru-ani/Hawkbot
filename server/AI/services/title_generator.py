from AI.providers.base import LLMProvider, Message
from AI.services.prompts import TITLE_GENERATOR_SYSTEM

MAX_TITLE_LENGTH = 60


class TitleGenerator:
    def __init__(self, llm: LLMProvider) -> None:
        self._llm = llm

    def generate(self, first_message: str) -> str:
        prompt = first_message.strip()
        if not prompt:
            return "New chat"

        try:
            result = self._llm.generate(
                [
                    Message(
                        role="user",
                        content=(
                            "Generate a short chat title for this first message.\n\n"
                            f"{prompt}"
                        ),
                    )
                ],
                system=TITLE_GENERATOR_SYSTEM,
            )
            title = self._sanitize(result)
            if title:
                return title
        except Exception:
            pass

        return self._fallback(prompt)

    @staticmethod
    def _sanitize(raw: str) -> str:
        title = raw.strip().strip("\"'").split("\n", 1)[0].strip()
        title = title.removeprefix("Title:").strip()
        if not title:
            return ""
        if len(title) > MAX_TITLE_LENGTH:
            return f"{title[: MAX_TITLE_LENGTH - 3].rstrip()}..."
        return title

    @staticmethod
    def _fallback(first_message: str, max_length: int = MAX_TITLE_LENGTH) -> str:
        line = first_message.strip().split("\n", 1)[0].strip()
        if not line:
            return "New chat"
        if len(line) <= max_length:
            return line
        return f"{line[: max_length - 3].rstrip()}..."
