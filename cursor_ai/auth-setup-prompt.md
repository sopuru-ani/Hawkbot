# Prompt: Set up MongoDB auth for Hawkbot

Copy everything below the line into a new Cursor session, **or** start with:

> Read and implement `cursor_ai/auth-setup-prompt.md` for Hawkbot.

---

## Task

Implement **user authentication for Hawkbot** using **MongoDB** for user accounts and **HTTP-only cookies** for sessions. No JWT in `localStorage`, no `Authorization: Bearer` headers. This is the foundation for per-user chat history later — get auth working end-to-end first.

## Project context

**Repo:** Hawkbot — unofficial UMES Q&A chat app  
**Stack:**
- **Backend:** Python FastAPI (`server/`), SSE streaming chat at `POST /api/chat`
- **Frontend:** React 19 + Vite + Tailwind v4 (`frontend/`)
- **MongoDB:** Already used for RAG chunk storage via `MONGODB_URI`, `MONGODB_DB`, `MONGODB_COLLECTION` (chunks). Auth uses the **same cluster** but **separate collections** — do not mix with chunk documents.
- **CORS:** `allow_credentials=True` already set in `server/main.py`. Origins include `http://localhost:5173` and LAN IP via `CORS_ORIGINS` in `server/config.py`.
- **Dev proxy:** Vite proxies `/api` → `127.0.0.1:8000`, so frontend and API share origin in dev — cookies work without cross-origin complexity.

**Current state:**
- No auth — `/api/chat` is public, accepts `{ messages: [{ role, content }] }` only
- Frontend sidebar shows placeholder **Guest User / Free plan** (`frontend/src/components/Sidebar.tsx`)
- Chat history lives only in React state — lost on refresh
- Broader project notes: `cursor_ai/session-2026-06-26.md`, index: `cursor_ai/INDEX.md`

**Key files to extend:**
- `server/main.py` — register auth routes, dependencies
- `server/config.py` — auth env vars (`SESSION_SECRET`, cookie TTL, etc.)
- `server/dependencies.py` — DI pattern used for chatbot service
- `server/routes/chat.py` — protect with auth
- `frontend/src/api/chat.ts` — `credentials: 'include'` on all API calls
- `frontend/src/components/Sidebar.tsx` — replace Guest User with real user + sign out

## Auth approach (required)

Use **HTTP-only cookies only**:

1. **Login/register** — server validates credentials, creates a session, sets an **HttpOnly** cookie (e.g. `session_id`).
2. **Authenticated requests** — browser sends cookie automatically; frontend uses `fetch(..., { credentials: 'include' })` everywhere.
3. **Logout** — server deletes session and clears the cookie via `Set-Cookie`.

**MongoDB collections:**
- **`users`** (required) — email (unique), password hash, `created_at`, optional display name
- **`sessions`** (required for this task) — `{ session_id, user_id, expires_at }` so logout and expiry work immediately. Index on `session_id`.

Do **not** use JWT in localStorage, refresh tokens in JS, or Bearer headers.

**Cookie settings:**
- Dev: `HttpOnly`, `SameSite=Lax`, `Secure=False` (HTTP localhost)
- Prod: add `Secure=True`
- Session secret from env (`SESSION_SECRET`), not hardcoded

## Requirements

### Backend
1. **Register + login + logout + me** under `/api/auth/` (`POST /register`, `POST /login`, `POST /logout`, `GET /me`)
2. **`get_current_user` dependency** — read session cookie → lookup in Mongo `sessions` → load user from `users`
3. **Protect `/api/chat`** — require authenticated user
4. **Indexes** — unique on `users.email`, index on `sessions.session_id` and TTL/expiry if supported
5. **Env vars** in `config.py` with dev defaults

### Frontend
1. **Auth UI** — minimal login + register (modal or page; Tailwind theme, maroon `#800000`)
2. **`useAuth` hook/context** — user, login, logout, register, loading; call `/api/auth/me` on mount
3. **All API calls** — `credentials: 'include'` only (no token storage in JS)
4. **Sidebar** — show logged-in user (name/email), sign out; gate chat if not logged in
5. **LAN testing** — works via Vite proxy at `http://192.168.1.9:5173`; note if direct `:8000` calls need extra CORS/cookie config

### Security
- bcrypt or argon2 for passwords; never store plaintext
- Validate email format, minimum password length
- Generic login errors (don’t reveal whether email exists)

### Out of scope
- Chat thread persistence / “New chat” / sidebar history
- OAuth, email verification, password reset (note as follow-up only)

## Acceptance criteria

- [ ] User can register, login, logout from the UI
- [ ] Auth uses HttpOnly cookie only — nothing sensitive in localStorage
- [ ] `GET /api/auth/me` returns user when logged in, 401 when not
- [ ] `/api/chat` requires auth
- [ ] `users` and `sessions` in Mongo; chunk collection untouched
- [ ] Sidebar shows real user when logged in
- [ ] Works on localhost; note LAN steps if any

## Conventions

- Match existing code style (Pydantic schemas, `@lru_cache` dependencies where appropriate)
- Minimal scope — no over-engineering
- Update `cursor_ai/INDEX.md` if you add new docs

## After implementing

Briefly summarize: schema, endpoints, cookie settings, frontend flow, env vars, and how to test locally.
