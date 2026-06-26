from collections.abc import Iterator

from google import genai
from google.genai import types

from AI.providers.base import Message


class GeminiProvider:
    def __init__(self, api_key: str, model: str) -> None:
        self._client = genai.Client(api_key=api_key)
        self._model = model

    def generate(self, messages: list[Message], *, system: str | None = None) -> str:
        response = self._client.models.generate_content(
            model=self._model,
            contents=self._to_contents(messages),
            config=self._build_config(system),
        )
        return response.text or ""

    def generate_stream(
        self, messages: list[Message], *, system: str | None = None
    ) -> Iterator[str]:
        stream = self._client.models.generate_content_stream(
            model=self._model,
            contents=self._to_contents(messages),
            config=self._build_config(system),
        )
        for chunk in stream:
            if chunk.text:
                yield chunk.text

    def _build_config(self, system: str | None) -> types.GenerateContentConfig | None:
        if not system:
            return None
        return types.GenerateContentConfig(system_instruction=system)

    def _to_contents(self, messages: list[Message]) -> list[types.Content]:
        contents: list[types.Content] = []
        for message in messages:
            role = "user" if message.role == "user" else "model"
            contents.append(
                types.Content(
                    role=role,
                    parts=[types.Part.from_text(text=message.content)],
                )
            )
        return contents
