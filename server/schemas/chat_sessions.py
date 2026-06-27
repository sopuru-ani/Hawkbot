from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class SessionSummary(BaseModel):
    id: str
    title: str
    updated_at: datetime


class StoredChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime
    mode: Literal["umes", "general"] | None = None
    sources: list[dict[str, str]] | None = None


class SessionDetail(BaseModel):
    id: str
    title: str
    messages: list[StoredChatMessage]
    created_at: datetime
    updated_at: datetime


class CreateSessionResponse(BaseModel):
    id: str
    title: str
    updated_at: datetime
