from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from auth.cookies import clear_session_cookie, set_session_cookie
from auth.store import AuthStore
from config import Settings, get_settings
from dependencies import get_auth_store, get_current_user
from schemas.auth import LoginRequest, RegisterRequest, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])

INVALID_CREDENTIALS = "Invalid email or password"


@router.post("/register", response_model=UserResponse)
def register(
    body: RegisterRequest,
    response: Response,
    store: AuthStore = Depends(get_auth_store),
    settings: Settings = Depends(get_settings),
) -> UserResponse:
    try:
        user = store.register(body.email, body.password, body.display_name)
    except ValueError as exc:
        if str(exc) == "email_taken":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists",
            ) from exc
        raise

    session_id = store.create_session(user["id"])
    set_session_cookie(response, settings, session_id)
    return UserResponse(**user)


@router.post("/login", response_model=UserResponse)
def login(
    body: LoginRequest,
    response: Response,
    store: AuthStore = Depends(get_auth_store),
    settings: Settings = Depends(get_settings),
) -> UserResponse:
    user = store.authenticate(body.email, body.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=INVALID_CREDENTIALS,
        )

    session_id = store.create_session(user["id"])
    set_session_cookie(response, settings, session_id)
    return UserResponse(**user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    request: Request,
    response: Response,
    store: AuthStore = Depends(get_auth_store),
    settings: Settings = Depends(get_settings),
) -> Response:
    session_id = request.cookies.get(settings.session_cookie_name)
    if session_id:
        store.delete_session(session_id)
    clear_session_cookie(response, settings)
    return response


@router.get("/me", response_model=UserResponse)
def me(user: UserResponse = Depends(get_current_user)) -> UserResponse:
    return user
