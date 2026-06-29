import json
from collections.abc import Iterator
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from AI.providers.base import Message
from AI.services.chatbot import ChatbotService, _sse
from AI.services.title_generator import TitleGenerator
from chat_sessions.store import ChatSessionStore
from dependencies import (
    get_chat_session_store,
    get_chatbot_service,
    get_current_user,
    get_title_generator,
)
from schemas.auth import UserResponse
from schemas.chat import ChatRequest

router = APIRouter(tags=["chat"])


@router.post("/chat")
def chat(
    request: ChatRequest,
    user: UserResponse = Depends(get_current_user),
    chatbot: ChatbotService = Depends(get_chatbot_service),
    session_store: ChatSessionStore = Depends(get_chat_session_store),
    title_generator: TitleGenerator = Depends(get_title_generator),
) -> StreamingResponse:
    messages = [
        Message(role=message.role, content=message.content)
        for message in request.messages
    ]
    user_content = request.messages[-1].content

    return StreamingResponse(
        _stream_with_persistence(
            chatbot=chatbot,
            session_store=session_store,
            title_generator=title_generator,
            user_id=user.id,
            session_id=request.session_id,
            messages=messages,
            user_content=user_content,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


def _stream_with_persistence(
    *,
    chatbot: ChatbotService,
    session_store: ChatSessionStore,
    title_generator: TitleGenerator,
    user_id: str,
    session_id: str | None,
    messages: list[Message],
    user_content: str,
) -> Iterator[str]:
    active_session_id = session_id
    should_title = False

    if active_session_id:
        session = session_store.get_session(user_id, active_session_id)
        if not session:
            yield _sse("error", {"message": "Session not found."})
            return
        should_title = session_store.has_default_title(user_id, active_session_id)
    else:
        created = session_store.create_session(user_id)
        active_session_id = created["id"]
        should_title = True

    assistant_parts: list[str] = []
    done_payload: dict | None = None
    errored = False

    for chunk in chatbot.stream_chat(messages):
        event, data = _parse_sse_chunk(chunk)
        if event == "token" and data and isinstance(data.get("text"), str):
            assistant_parts.append(data["text"])
            yield chunk
        elif event == "error":
            errored = True
            yield chunk
        elif event == "done" and data is not None:
            done_payload = dict(data)
        else:
            yield chunk

    if errored or done_payload is None:
        return

    now = datetime.now(timezone.utc)
    stored_messages = [
        {"role": "user", "content": user_content, "created_at": now},
        {
            "role": "assistant",
            "content": "".join(assistant_parts),
            "created_at": now,
            "mode": done_payload.get("mode"),
            "sources": done_payload.get("sources") or None,
        },
    ]
    session_store.append_messages(user_id, active_session_id, stored_messages)

    done_payload["session_id"] = active_session_id
    if should_title:
        title = title_generator.generate(user_content)
        session_store.set_title(user_id, active_session_id, title)
        done_payload["title"] = title

    yield _sse("done", done_payload)


def _parse_sse_chunk(chunk: str) -> tuple[str, dict | None]:
    event = "message"
    data: dict | None = None

    for line in chunk.split("\n"):
        if line.startswith("event:"):
            event = line[6:].strip()
        elif line.startswith("data:"):
            raw = line[5:].strip()
            if raw:
                data = json.loads(raw)

    return event, data
