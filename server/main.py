from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_cors_origins
from routes.auth import router as auth_router
from routes.chat import router as chat_router
from routes.chat_sessions import router as chat_sessions_router

app = FastAPI(title="Hawkbot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(chat_sessions_router, prefix="/api")


@app.get("/")
def root():
    return {"message": "Hawkbot API is running"}


@app.get("/health")
def health():
    return {"status": "ok"}
