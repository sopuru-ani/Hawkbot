# Auth implementation

MongoDB-backed session auth with HTTP-only cookies. Implemented 2026-06-26.

## MongoDB collections

**`users`**
- `email` (unique index)
- `password_hash` (bcrypt)
- `display_name` (optional)
- `created_at`

**`sessions`**
- `session_id` (unique index)
- `user_id` (ObjectId → users)
- `expires_at` (TTL index, `expireAfterSeconds: 0`)

Chunk collection is unchanged.

## API endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | No | Create account, set session cookie |
| POST | `/api/auth/login` | No | Validate credentials, set session cookie |
| POST | `/api/auth/logout` | No | Delete session, clear cookie |
| GET | `/api/auth/me` | Cookie | Current user or 401 |
| POST | `/api/chat` | Cookie | Requires authenticated user |

## Cookie

- Name: `session_id` (configurable)
- `HttpOnly`, `SameSite=Lax`, `Path=/`
- `Secure=false` in dev (`COOKIE_SECURE=false`)
- `Secure=true` in prod (`COOKIE_SECURE=true`)

## Env vars

```
SESSION_SECRET=...          # dev default in config; change in prod
SESSION_COOKIE_NAME=session_id
SESSION_TTL_DAYS=30
COOKIE_SECURE=false         # true in prod
MONGODB_USERS_COLLECTION=users
MONGODB_SESSIONS_COLLECTION=sessions
```

Uses existing `MONGODB_URI` and `MONGODB_DB`.

## Frontend

- `AuthProvider` + `useAuth` — loads `/api/auth/me` on mount
- `AuthModal` — login / register
- All API calls use `credentials: 'include'`
- Chat gated until signed in; sidebar shows user + sign out

## Local testing

1. Install backend dep: `pip install bcrypt` (or `pip install -r server/requirements.txt`)
2. Start API: `uvicorn main:app --reload` from `server/`
3. Start frontend: `npm run dev` from `frontend/`
4. Open `http://localhost:5173` — register, then chat
5. **LAN:** use `http://192.168.1.9:5173` (Vite proxy). Do not call `:8000` directly from the browser or cookies/CORS will break.

## Follow-ups

- Chat thread persistence
- OAuth, email verification, password reset
