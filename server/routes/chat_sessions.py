from fastapi import APIRouter, Depends, HTTPException, status

from chat_sessions.store import ChatSessionStore
from dependencies import get_chat_session_store, get_current_user
from schemas.auth import UserResponse
from schemas.chat_sessions import CreateSessionResponse, SessionDetail, SessionSummary

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.get("", response_model=list[SessionSummary])
def list_sessions(
    user: UserResponse = Depends(get_current_user),
    store: ChatSessionStore = Depends(get_chat_session_store),
) -> list[SessionSummary]:
    return [SessionSummary(**session) for session in store.list_sessions(user.id)]


@router.post("", response_model=CreateSessionResponse, status_code=status.HTTP_201_CREATED)
def create_session(
    user: UserResponse = Depends(get_current_user),
    store: ChatSessionStore = Depends(get_chat_session_store),
) -> CreateSessionResponse:
    session = store.create_session(user.id)
    return CreateSessionResponse(**session)


@router.get("/{session_id}", response_model=SessionDetail)
def get_session(
    session_id: str,
    user: UserResponse = Depends(get_current_user),
    store: ChatSessionStore = Depends(get_chat_session_store),
) -> SessionDetail:
    session = store.get_session(user.id, session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return SessionDetail(**session)


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(
    session_id: str,
    user: UserResponse = Depends(get_current_user),
    store: ChatSessionStore = Depends(get_chat_session_store),
) -> None:
    deleted = store.delete_session(user.id, session_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
