from AI.providers.base import LLMProvider, Message
from AI.services.prompts import WEB_QUERY_REWRITER_SYSTEM


class WebQueryRewriter:
    def __init__(self, llm: LLMProvider) -> None:
        self._llm = llm

    def rewrite(self, messages: list[Message]) -> str:
        latest = messages[-1].content.strip()
        if len(messages) == 1:
            return latest

        transcript = self._format_transcript(messages)
        rewrite_messages = [
            Message(
                role="user",
                content=(
                    "Rewrite the latest user message as a standalone web search query. "
                    "Resolve pronouns and vague references using the conversation.\n\n"
                    f"{transcript}\n\n"
                    "Reply with only the rewritten search query."
                ),
            )
        ]
        rewritten = self._llm.generate(
            rewrite_messages, system=WEB_QUERY_REWRITER_SYSTEM
        ).strip()
        return rewritten or latest

    def _format_transcript(self, messages: list[Message]) -> str:
        lines: list[str] = []
        for message in messages:
            speaker = "User" if message.role == "user" else "Assistant"
            lines.append(f"{speaker}: {message.content}")
        return "\n".join(lines)
