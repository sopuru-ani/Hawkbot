from collections.abc import Iterator
from dataclasses import dataclass
from typing import Literal, Protocol


@dataclass(frozen=True)
class Message:
    role: Literal["user", "assistant"]
    content: str


class LLMProvider(Protocol):
    def generate(self, messages: list[Message], *, system: str | None = None) -> str: ...

    def generate_stream(
        self, messages: list[Message], *, system: str | None = None
    ) -> Iterator[str]: ...
