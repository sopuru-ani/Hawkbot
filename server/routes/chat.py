from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from AI.providers.base import Message
from dependencies import get_chatbot_service
from schemas.chat import ChatRequest

router = APIRouter(tags=["chat"])


@router.post("/chat")
def chat(request: ChatRequest) -> StreamingResponse:
    messages = [
        Message(role=message.role, content=message.content)
        for message in request.messages
    ]
    service = get_chatbot_service()
    return StreamingResponse(
        service.stream_chat(messages),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
