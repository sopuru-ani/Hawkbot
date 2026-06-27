# Post-auth product backlog — Hawkbot

What was discussed as “what’s left” after chat UI + RAG, and the order to build it.

**Prerequisite (done):** Auth — see [auth-implementation.md](./auth-implementation.md). Users log in via HttpOnly cookie; `/api/chat` requires auth.

---

## The items (plain English)

### 1. Chat sessions (persisted conversations)

**Problem today:** Messages live only in React state. Refresh or close tab → history is gone.

**Goal:** Each conversation is a **thread** with:
- `id`
- `user_id` (from auth)
- `title` (see auto-title below)
- `messages[]` (role, content, timestamps)
- `created_at` / `updated_at`

**User-facing behavior:**
- **New chat** → start empty thread
- Switching threads loads that thread’s messages
- History survives refresh and works across devices (MongoDB, not `localStorage`)

**MongoDB (suggested):** `chat_sessions` collection; optionally embed messages or use a separate `chat_messages` collection keyed by `session_id`.

---

### 2. Sidebar wiring (“New chat” / “Search chats”)

**Problem today:** `frontend/src/components/Sidebar.tsx` has placeholder buttons with no actions.

**Goal once sessions exist:**
- **New chat** — create thread, clear main chat view
- **Recents list** — show user’s past threads (title + last updated), click to open
- **Search chats** — filter recents by title (simple substring search is fine v1)

This is mostly frontend + list/create/load session APIs.

---

### 3. Auto-title

**Problem today:** Threads would show “Untitled” forever.

**Goal:** When a user sends the **first message** in a new thread, generate a short title (e.g. from that message via a small LLM call, or truncate/sanitize the first line client-side for v1).

**Note:** This is **metadata on a session**, not a separate feature. Build it right after (or with) persisted sessions.

---

### 4. Memory

Two flavors were discussed:

| Type | What it means | Depends on |
|------|----------------|------------|
| **History memory** | Load recent messages from the **current** thread (and maybe last N threads) into the chat request so the model has context | Sessions in DB |
| **Long-term memory** | Extract and store **facts about the user** (“I’m a UMES student”, “interested in nursing”) and inject relevant facts into prompts on future chats | Auth + persisted messages |

Long-term memory is a **later layer** — don’t block sessions/titles on it.

---

### 5. Latency optimization (optional, separate)

Not user-facing product features, but noted as follow-ups:
- Merge classify / rewrite / route into fewer LLM calls before streaming
- Optional flag to disable cross-encoder rerank on slow connections
- Cold-start cost: cross-encoder downloads ~91MB on first UMES query after server boot

---

## Recommended build order

```
Auth (done) → Chat sessions in Mongo → Sidebar wiring → Auto-title → Memory
```

Skip `localStorage`-only sessions — auth is in place; go straight to **user-scoped MongoDB**.

---

## Copy-paste prompt for next session

Use this after auth is working. Attach `@cursor_ai/auth-implementation.md` and `@cursor_ai/session-2026-06-26.md` if helpful.

---

### Task

Implement **user-scoped chat sessions** for Hawkbot, wire the **sidebar**, and add **auto-title**. Auth is already done (HttpOnly cookies, Mongo `users` + `sessions`).

### Context

- **Backend:** FastAPI, `POST /api/chat` streams SSE, requires auth (`get_current_user`)
- **Frontend:** React + Vite, sidebar placeholders in `Sidebar.tsx` (New chat, Search chats), chat state in `App.tsx`
- **MongoDB:** Same cluster as auth and RAG chunks; use **new collections** for chat data (e.g. `chat_sessions`, optionally `chat_messages`)

### Requirements

**Backend**
1. CRUD/list APIs under `/api/sessions/` (names flexible), all scoped to `current_user`:
   - `GET /api/sessions` — list user’s threads (id, title, updated_at), newest first
   - `POST /api/sessions` — create empty thread (title `"New chat"` or `"Untitled"` until first message)
   - `GET /api/sessions/{id}` — thread + messages
   - `DELETE /api/sessions/{id}` — optional v1
2. **Persist messages** — on chat completion (or incrementally), save user + assistant messages to the active session
3. **Auto-title** — after first user message in a new thread, set title (LLM one-liner or truncated first message; keep it cheap)
4. `/api/chat` — accept optional `session_id`; attach messages to that session; return `session_id` in stream metadata if creating new

**Frontend**
1. **New chat** — creates session, clears view
2. **Recents** in sidebar — load from API, highlight active thread
3. **Search chats** — filter recents by title (client-side filter OK)
4. On load, restore **last active session** or show empty state
5. All fetches: `credentials: 'include'`

### Out of scope (this task)

- Long-term user memory / fact extraction
- OAuth, password reset
- Full-text search across message bodies (title filter only for v1)

### Acceptance criteria

- [ ] Logged-in user sees past chats in sidebar after refresh
- [ ] New chat / open chat / send message works end-to-end
- [ ] Titles update after first message (not stuck on Untitled)
- [ ] Sessions keyed by `user_id`; users cannot read each other’s threads
- [ ] Brief summary of schema, endpoints, and how to test

### Conventions

- Match existing code style; minimal scope
- Update `cursor_ai/INDEX.md` if you add docs
- Don’t commit unless the user asks

---

## Memory — separate follow-up prompt (later)

When sessions work, use a new session for memory:

> Implement **history memory** for Hawkbot: when calling `/api/chat`, include recent messages from the current session (already partially sent from frontend — ensure server loads full history from DB if needed). Then add **long-term memory**: extract stable user facts from conversations, store in Mongo (`user_memories` or similar), retrieve relevant facts per query and inject into the system prompt. Auth + `chat_sessions` already exist — see `cursor_ai/post-auth-roadmap.md`.
