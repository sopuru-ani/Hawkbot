# Tavily web search implementation

Live web search and URL extraction for general chat questions, using the official Tavily Python SDK (`TavilyClient`). Implemented 2026-06-27.

No LangChain, no agent loop — same orchestration pattern as UMES RAG: call an external API, inject context into the prompt, stream the LLM answer.

---

## Design decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Integration style | Direct `TavilyClient` SDK | Matches existing thin-client pattern (Pinecone, OpenAI); no LangChain dependency |
| Tavily methods | `search()` + `extract()` only | Covers current-events Q&A and pasted URLs; `research()` deferred (slow, different UX) |
| When to search | LLM gate on `general` branch | Avoids Tavily calls on writing help, coding, etc. |
| URL handling | Regex detect → `extract()` | Skips gate when user pastes a link; uses query-focused extraction |
| Provider impact | None | Tavily is wired in `dependencies.py`; `LLMProvider` unchanged |
| Failure mode | Silent fallback | Tavily errors → plain `GENERAL_SYSTEM` answer (chat does not break) |
| Sources | Reuse `Source(title, url)` | Same `done` SSE payload and frontend source list as UMES RAG |

---

## Chat flow

```
POST /api/chat
    │
    ▼
classify (umes | general)
    │
    ├── umes ──► query rewrite ──► section route ──► Pinecone RAG ──► RAG_SYSTEM ──► stream
    │
    └── general
            │
            ├── message contains URL(s)? ──► Tavily extract() ──► WEB_EXTRACT_SYSTEM ──► stream
            │
            ├── web gate says yes? ──► web query rewrite ──► Tavily search() ──► WEB_SEARCH_SYSTEM ──► stream
            │
            └── otherwise ──► GENERAL_SYSTEM ──► stream (no Tavily)
```

SSE status stages emitted on the web paths:

| Stage | Message | When |
|-------|---------|------|
| `searching_web` | `"Searching the web..."` | Tavily `search()` |
| `searching_web` | `"Reading linked pages..."` | Tavily `extract()` |

---

## Dependencies added

```bash
pip install tavily-python
```

| Package | Version | Purpose |
|---------|---------|---------|
| `tavily-python` | `0.7.26` | Official Tavily SDK (`TavilyClient`) |

Added to `server/requirements.txt`.

---

## Env vars

```
TAVILY_API_KEY=tvly-...          # required
TAVILY_MAX_RESULTS=5             # optional, default 5
```

Loaded in `server/config.py` → `Settings.tavily_api_key`, `Settings.tavily_max_results`.

---

## New files

### `server/AI/retrieval/web_search.py`

- **`extract_urls(text)`** — regex URL parser; dedupes and strips trailing punctuation
- **`TavilyWebSearch`**
  - `search(query)` → `WebSearchResult(context, sources)` via `client.search()`
  - `extract_urls(urls, query=None)` → same shape via `client.extract()` with optional query-focused chunks
- Reuses `Source` from `AI.retrieval.retriever` for consistent `{ title, url }` output

### `server/AI/services/web_search_gate.py`

- **`WebSearchGate.needs_web_search(messages)`** — one LLM call; replies `yes` / `no`
- Uses `WEB_SEARCH_GATE_SYSTEM` prompt
- Runs only when no URLs are in the latest user message

### `server/AI/services/web_query_rewriter.py`

- **`WebQueryRewriter.rewrite(messages)`** — standalone web search query for follow-ups
- Separate from UMES `QueryRewriter` (neutral prompt, not UMES-knowledge-base focused)

---

## Modified files

### `server/AI/services/chatbot.py`

- Constructor accepts `web_search`, `web_search_gate`, `web_query_rewriter`
- `general` branch calls `_try_web_context()` before streaming
- `_extract_url_context()` — URL path, uses `_message_without_urls()` for extract query
- Tavily failures return `None` → falls back to normal general answer

### `server/AI/services/prompts.py`

| Prompt | Purpose |
|--------|---------|
| `WEB_SEARCH_GATE_SYSTEM` | Gate: does this need live web info? |
| `WEB_QUERY_REWRITER_SYSTEM` | Rewrite follow-ups for web search |
| `WEB_SEARCH_SYSTEM` | System prompt when search results are injected |
| `WEB_EXTRACT_SYSTEM` | System prompt when extracted page content is injected |
| `GENERAL_SYSTEM` | Updated — Hawkbot knows it has web search + URL read capabilities (fixes “I don’t have internet” replies on meta questions) |

### `server/config.py`

- `tavily_api_key: str`
- `tavily_max_results: int`

### `server/dependencies.py`

- Instantiates `TavilyWebSearch`, `WebSearchGate`, `WebQueryRewriter`
- Passes them into `ChatbotService`

### `frontend/src/types/chat.ts`

- Added `'searching_web'` to `ChatStage` union (thinking UI picks up new status messages automatically)

---

## API / SSE (unchanged contract)

No new endpoints. Existing `POST /api/chat` SSE events:

```json
{ "event": "status", "data": { "stage": "searching_web", "message": "Searching the web..." } }
{ "event": "token",  "data": { "text": "..." } }
{ "event": "done",   "data": { "mode": "general", "sources": [{ "title": "...", "url": "..." }] } }
```

`mode` stays `umes` or `general`. Web-sourced links appear in `sources` the same way UMES RAG sources do.

---

## Prompt awareness (follow-up fix)

**Problem:** Asking “do you have internet access?” classified as `general`, web gate said `no`, and `GENERAL_SYSTEM` (pre-fix) never mentioned web search — model defaulted to generic “I’m a text-based AI without internet.”

**Fix:** `GENERAL_SYSTEM` now states Hawkbot can search the web for live/current topics and read user-shared URLs, and should say so when asked even if that message did not trigger a search.

---

## Local testing

1. Add `TAVILY_API_KEY` to `server/.env`
2. Restart API: `uvicorn main:app --reload` from `server/`
3. Sign in and open chat

| Test message | Expected behavior |
|--------------|-------------------|
| “What's going on with the NBA playoffs?” | `searching_web` → answer with source links |
| “Summarize this: https://example.com” | `Reading linked pages...` → summary |
| “Help me write a thank-you email” | `general` stage only, no sources |
| “Do you have internet access?” | Explains web search capability (no Tavily call) |
| UMES tuition question | `retrieving` → Pinecone RAG (unchanged) |

Quick SDK smoke test from `server/`:

```bash
python -c "from config import get_settings; from AI.retrieval.web_search import TavilyWebSearch; s=get_settings(); r=TavilyWebSearch(s.tavily_api_key).search('latest AI news'); print(len(r.sources), len(r.context))"
```

---

## Architecture notes

```
dependencies.py
    └── TavilyWebSearch(api_key, max_results)
    └── WebSearchGate(llm)
    └── WebQueryRewriter(llm)
            └── ChatbotService
                    └── stream_chat()
                            └── LLMProvider.generate_stream()  ← same provider as before
```

Tavily is **provider-agnostic** — swapping `OpenAICompatibleProvider` for `GeminiProvider` in `dependencies.py` does not affect Tavily wiring.

**Not implemented:** `research()` (async deep-research reports), LangChain `TavilySearchResults`, provider toggle env var.

---

## Known limitations

- Web gate may occasionally misclassify (skip search when needed, or vice versa)
- `extract()` may fail on paywalled or login-only pages
- Search returns snippets, not full page content (unless user provides the URL)
- UMES + “latest news about UMES” may still route to Pinecone RAG, not Tavily
- One extra LLM call per general message that reaches the web gate (no URL in message)

---

## Follow-ups (optional)

- `research()` mode for explicit “deep dive” requests (separate UX, polling/streaming)
- Detect “latest / current / today” on UMES questions and optionally augment with Tavily
- Unit tests for `extract_urls()` and `_message_without_urls()`
- Force-search override (user says “search the web for …”)
