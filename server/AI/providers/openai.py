from collections.abc import Iterator

from openai import OpenAI

from AI.providers.base import Message


class OpenAICompatibleProvider:
    """Works with OpenAI, NVIDIA NIM, and any OpenAI-compatible API."""

    def __init__(self, api_key: str, base_url: str, model: str) -> None:
        self._client = OpenAI(api_key=api_key, base_url=base_url)
        self._model = model

    def generate(self, messages: list[Message], *, system: str | None = None) -> str:
        response = self._client.chat.completions.create(
            model=self._model,
            messages=self._to_api_messages(messages, system),
        )
        return response.choices[0].message.content or ""

    def generate_stream(
        self, messages: list[Message], *, system: str | None = None
    ) -> Iterator[str]:
        stream = self._client.chat.completions.create(
            model=self._model,
            messages=self._to_api_messages(messages, system),
            stream=True,
        )
        for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta

    def _to_api_messages(
        self, messages: list[Message], system: str | None
    ) -> list[dict[str, str]]:
        api_messages: list[dict[str, str]] = []
        if system:
            api_messages.append({"role": "system", "content": system})
        for message in messages:
            api_messages.append({"role": message.role, "content": message.content})
        return api_messages
