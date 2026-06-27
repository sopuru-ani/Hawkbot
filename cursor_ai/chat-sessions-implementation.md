# Chat sessions implementation

User-scoped persisted chat threads in MongoDB, sidebar recents, and auto-title. Implemented 2026-06-27.

## MongoDB collection

**`chat_sessions`** (env: `MONGODB_CHAT_SESSIONS_COLLECTION`, default `chat_sessions`)

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | Session id |
| `user_id` | ObjectId | Owner — all queries filter by this |
| `title` | string | `"New chat"` until first message, then auto-titled |
| `messages` | array | Embedded `{ role, content, created_at, mode?, sources? }` |
| `created_at` | datetime | UTC |
| `updated_at` | datetime | UTC, indexed with `user_id` for listing |

Index: `(user_id, updated_at DESC)`.

## API endpoints

All require auth cookie (`get_current_user`).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/sessions` | List user's threads (id, title, updated_at), newest first |
| POST | `/api/sessions` | Create empty thread (`title: "New chat"`) |
| GET | `/api/sessions/{id}` | Full thread + messages |
| DELETE | `/api/sessions/{id}` | Delete thread (404 if not owned / missing) |
| POST | `/api/chat` | Stream chat; optional `session_id` in body |

### Chat + persistence

`POST /api/chat` body:

```json
{
  "messages": [{ "role": "user", "content": "..." }],
  "session_id": "optional-existing-id"
}
```

- If `session_id` omitted, a new session is created before streaming.
- After a successful stream, user + assistant messages are appended to the session.
- On the **first message** in a default-titled thread, title is set from the first line of the user message (truncated to 50 chars).
- The `done` SSE event includes `session_id` and `title` (when newly generated).

## Frontend

- **`ChatSessionsProvider`** — loads session list when user is signed in.
- **Sidebar** — New chat (POST + navigate), Recents list, Search chats link.
- **`ChatPage`** — loads thread by URL `/chat/:chatId`, persists via `session_id` on send, restores last active session from `localStorage` (`hawkbot:lastSessionId`) on `/chat`.
- **`SearchPage`** — client-side title filter over session list.

## Env vars

```
MONGODB_CHAT_SESSIONS_COLLECTION=chat_sessions
```

Uses existing `MONGODB_URI` and `MONGODB_DB`.

## Local testing

1. Start API: `uvicorn main:app --reload` from `server/`
2. Start frontend: `npm run dev` from `frontend/`
3. Register / log in at `http://localhost:5173`
4. Send a message — sidebar should show the thread with an auto-generated title
5. Refresh — messages and sidebar recents should persist
6. **New chat** — empty thread; first message updates title
7. **Search chats** — filter by title substring
8. Open a second browser / incognito with another account — cannot see the first user's threads

## Follow-ups

- History memory (load prior turns into `/api/chat` from DB)
- Long-term user memory (`user_memories`)
- LLM-based titles (optional upgrade from truncation)
