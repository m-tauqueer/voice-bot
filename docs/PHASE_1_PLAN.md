# Phase 1 build plan — Brain first (typed chat, no voice)

Detailed, implementation-level plan for Phase 1. Owner: Tauqueer. Read [AGENTS.md](../AGENTS.md), [PRD.md](PRD.md), and [TRD.md](TRD.md) first. This document expands [PHASE_PLAN.md](PHASE_PLAN.md) parts 1.1–1.8 into exact logic so an implementer (human or model) does not have to guess or invent APIs.

> Phase 1 goal: a signed-in user holds a **typed** conversation with the single seeded persona. Every reply is grounded in Engram (`personas.chat`), reframed into natural spoken-style text, gated by the controller, and persisted to Postgres. Memory must survive a process restart. **No audio, no Deepgram, no browser mic in Phase 1** — those are Phase 2.

---

## 0. How to use this document

- Build **one part at a time**, in order, only when Tauqueer names it. Each part below has: **Goal**, **Files**, **Logic**, **Config**, **Errors**, **Manual test**, **Done when**.
- **Do not mention phase numbers or part numbers** in commit messages, code comments, or PR titles. Describe the work in plain language. The numbered headings in this file are Tauqueer's catalog only.
- **Ground truth is code + the verified SDK surface in §2**, not prose in the MD files. The TRD/PRD describe intent; where they conflict with §2, §2 wins (it was introspected from the installed `engram-ai-sdk==0.4.0`).
- **Hard rules (from [AGENTS.md](../AGENTS.md) §7), enforced in every part:**
  - No hardcoding. Every value that could change lives in config/env or the database, never baked into logic.
  - **No keyword matching, no intent if/else, no "if text contains X".** The controller and any understanding of the user derive only from model output or structured signals (SDK result fields, HTTP status, counts, enums). Infra thresholds (timeouts, token limits, TTLs, ports) are allowed.
  - Build for production. No "TODO later" holes in a part you call done.

---

## 1. What already exists (Phase 0 baseline — do not rebuild)

| Area | File | State |
| --- | --- | --- |
| Gateway config (Zod, fail-fast) | `gateway/src/config.ts` | Loads root `.env`, validates. Exports `loadGatewayConfig()`, `repoRootFromHere()`. |
| Gateway clients | `gateway/src/clients.ts` | `createPostgres` (postgres.js), `createRedis` (ioredis), `createBlobService` (Azure). |
| Gateway app | `gateway/src/index.ts` | Fastify + `@fastify/cors` (origin = `FRONTEND_ORIGIN`) + `@fastify/websocket`, `GET /health`. |
| Gateway smoke | `gateway/src/smoke.ts` | Applies `infra/migrations/*.sql` via a `schema_migrations` ledger; vendor reachability checks. |
| Worker config (pydantic-settings) | `worker/src/worker/config.py` | Loads root `.env`, fail-fast. `load_settings()`. |
| Worker clients | `worker/src/worker/clients.py` | `create_postgres` (psycopg), `create_engram` (EngramClient), `create_openai`. |
| Worker app | `worker/src/worker/main.py` | FastAPI + structlog, `GET /health`. |
| Migrations dir | `infra/migrations/0001_baseline.sql` | `SELECT 1;` only. Product tables come in Part 1.1. |

Config keys already present in `.env` / `.env.example`: `NODE_ENV`, `LOG_LEVEL`, gateway/worker host+port+URLs, `DATABASE_URL`, `REDIS_URL`, `SESSION_SECRET` (≥16), `INTERNAL_API_SECRET` (≥16), Google (`GOOGLE_CLIENT_ID/SECRET/CALLBACK_URL/OIDC_DISCOVERY_URL`), and optional Engram/OpenAI/Azure/Deepgram keys. **New keys introduced by Phase 1 are listed per part and must be added to `.env.example` (and the loader schemas) in the same part.**

---

## 2. Verified Engram SDK surface (introspected from `engram-ai-sdk==0.4.0`)

Use these exact signatures. Do **not** invent methods or fields. `Any` means the SDK returns a loosely-typed object; when you need a field, read it from the dataclass fields listed here or from `.raw`.

### 2.1 Client

```
EngramClient(org_id: str, user_id: str = "", *, api_key: str | None = None,
             base_url: str | None = None, timeout: float = 30.0,
             max_retries: int = 2, transport=None)
```

- Instance namespaces include: `personas`, `sessions`, `threads`, `conversation`, `memory`, `ingest`, `insights`, `members`, `account`, `config`, `health`.
- `create_engram(settings, user_id)` in `worker/src/worker/clients.py` already constructs this correctly (org_id, user_id, api_key, base_url, timeout). **Each end user gets their own client instance scoped to their Engram `user_id`.**

### 2.2 `client.personas` methods (Phase 1 uses these)

```
create(name, *, handle=None, description=None, avatar_url=None) -> Persona
get(persona_id) -> Persona
list() -> list[Persona]
update(persona_id, **fields) -> Persona
teach(persona_id, text) -> Any
answer(persona_id, question_key, text) -> Any
questions(persona_id) -> Any
subscribe(persona_id, user_id) -> Any
unsubscribe(persona_id, user_id) -> Any
subscribers(persona_id) -> Any
chat(persona_id, message, *, session_id=None) -> PersonaReply
retrieve(persona_id, query, *, top_k=10) -> Any        # NOT used on the per-turn path
shared(persona_id) -> PersonaIngest
private(persona_id, user_id=None) -> PersonaIngest
conversations(persona_id, *, scope="private", user_id=None) -> Any
```

`PersonaIngest` (returned by `shared(pid)` / `private(pid)`) exposes `document(...)`, `text(...)`, `file(...)`:

```
shared(pid).document(document, *, metadata=None, session_id=None, encoding="utf-8", max_bytes=...) -> IngestResult
shared(pid).text(text, *, metadata=None, session_id=None) -> IngestResult
```

### 2.3 Result shapes (dataclass fields)

- `PersonaReply`: **`messages: list[str]`**, `memories_used: list[Any]`, `session_id: str | None`, `raw: dict`.
  - **CRITICAL: there is no `reply.text`.** The persona answer is `messages` — a short run of texting-style bubbles (normally 1–2, at most 3). Flatten to one utterance by joining the bubbles (join order = list order; separator is config, default single space). Persist both the raw `messages` list and the flattened string.
  - `memories_used` is the structured grounding signal (opaque list). Persist it (see `memory_refs`) and expose its presence/count to the controller as a **structured signal**, never parsed for keywords.
  - `session_id` is the Engram conversation id to carry forward. On the first turn of a session it may be returned here; store it and pass it back on every subsequent `chat`.
- `Persona`: `id`, `org_id`, `name`, `handle`, `description`, `avatar_url`, `status`, `tenant`, `created_at`, `raw`. Use `.id` as the Engram `persona_id`; never build tenant strings by hand (read `.tenant` if needed).
- `IngestResult`: `gid`, `perception`, `incomplete`, `raw`.

### 2.4 Error taxonomy (exact classes)

Base: `EngramError`. HTTP errors: `EngramAPIError(status: int, detail: str)` with `.status` and `.detail`. Typed subclasses (all extend `EngramAPIError`):

| Class | HTTP | Meaning / handling |
| --- | --- | --- |
| `UnauthorizedError` | 401 | bad/missing API key — fail fast, do not retry. |
| `PaymentRequiredError` | 402 | quota/billing — surface honestly, do not retry. |
| `ForbiddenError` | 403 | user not subscribed to persona — surface as "not subscribed". |
| `NotFoundError` | 404 | unknown persona/session — fail. |
| `ConflictError` | 409 | conflicting write — do not blind-retry. |
| `ValidationError` | 422 | bad request payload — fail, log detail. |
| `ServerError` | 5xx | transient. **Reads** may retry (429/502/503/504); **writes are never blind-retried** (TRD §3). |

The wrapper (Part 1.2) maps these into the app error type; nothing downstream should touch raw HTTP.

---

## 3. Phase 1 data flow (typed turn)

No Deepgram/BYO-LLM in Phase 1. The gateway exposes an authenticated HTTP endpoint; the worker runs the brain.

```
browser (chat UI, session cookie)
  -> POST gateway /api/chat  { text }            (gateway: auth + resolve app user + persona)
  -> POST worker  /internal/turn  { app_user_id, engram_user_id, persona_id, session_id?, text }
        worker:
          1. controller.pre(): structured pre-checks (has input text? persona resolved?)
          2. engram wrapper.chat(persona_id, text, session_id) -> PersonaReply
          3. controller.decide(reply, signals) -> { action: speak|silence, reason_codes[], hints }
          4. if speak: reframe(reply.messages, last_N_turns, persona.voice_config) -> spoken text
          5. persist: sessions (upsert engram session_id), turns (user + persona), memory_refs, latency_spans
          6. return { action, reply_text, session_id, turn_ids }
  <- gateway returns reply to browser; browser appends to transcript
```

Persistence owner in Phase 1: **the worker** writes `sessions`, `turns`, `memory_refs`, `latency_spans` (it owns the brain and Postgres turn-writes per TRD §2.3). The gateway owns auth, the HTTP surface, and (Phase 2) audio URLs.

---

## 4. Locked decisions (confirmed by owner)

These are settled and used throughout the sections below.

- **D1 — Engram `user_id` value → app user UUID.** Send our own `users.id` (UUID) to Engram as `user_id`; stored in `users.engram_user_id`. Engram identity is decoupled from Google.
- **D2 — Migrations → forward-only SQL runner in the gateway.** A single runner applies `infra/migrations/NNNN_*.sql` in order using the existing `schema_migrations` ledger (the same one `smoke.ts` uses). Exposed as `npm run migrate` / `make migrate`; `smoke.ts` delegates to it (no second applier, no second ledger). No down/rollback migrations.
- **D3 — Auth session → server-side session in Redis.** Random session id stored in Redis with TTL; the cookie is opaque, signed, HttpOnly, SameSite, `Secure` in production. Chosen for security and easy revocation; secrets never leave the server.
- **D4 — Persona admin → both CLI and UI in Part 1.4.** Ship the worker seeding CLI **and** the minimal admin UI screen (owner-guarded) in the same part; both drive the same Part 1.2 wrapper.

---

## Part 1.1 — Postgres schema & migrations

**Goal.** The canonical data model from [TRD §5](TRD.md) exists and applies cleanly to an empty DB.

**Files.**
- `infra/migrations/0002_core.sql` (and further numbered files as needed) — DDL.
- Migration runner (D2): `gateway/src/migrate.ts` + a `"migrate"` script in `gateway/package.json` and root `package.json`; `make migrate`.
- Update `gateway/src/smoke.ts` to call the shared runner (remove the duplicate inline applier so there is exactly one migration path and one ledger).

**Logic — tables (finalize TRD §5).** All ids are UUID (`gen_random_uuid()`, enable `pgcrypto`), all timestamps `timestamptz default now()`. No seeded/hardcoded rows.

- `users` — `id` (uuid pk), `google_sub` (text unique), `email` (text), `engram_user_id` (text unique; value per **D1**), `created_at`, `updated_at`.
- `personas` — `id` (uuid pk), `engram_persona_id` (text unique), `handle` (text unique), `display_name` (text), `description` (text null), `voice_config` (jsonb not null default `'{}'`), `created_at`, `updated_at`. Holds the single seeded persona; the app resolves the active persona from this table (no persona id in env).
- `subscriptions` — `id`, `user_id` fk→users, `persona_id` fk→personas, `status` (text), `created_at`; unique `(user_id, persona_id)`. Mirrors Engram subscription state for admin visibility.
- `sessions` — `id` (uuid pk = app session id), `user_id` fk, `persona_id` fk, `engram_session_id` (text null until first reply), `channel` (text; `'text'` in Phase 1), `started_at`, `ended_at` (null).
- `turns` — `id`, `session_id` fk, `ordinal` (int), `speaker` (text: `user`|`persona`), `text` (text; flattened for persona turns), `messages` (jsonb null; raw `PersonaReply.messages`), `controller_action` (text null), `controller_reasons` (jsonb null), `stt_meta` (jsonb null; Phase 2), `tts_meta` (jsonb null; Phase 2), `created_at`; unique `(session_id, ordinal)`.
- `memory_refs` — `id`, `turn_id` fk, `memories_used` (jsonb), `engram_session_id` (text), `created_at`. Audit/debug of what Engram grounded on.
- `audio_assets` — `id`, `turn_id` fk, `direction` (text: `user`|`bot`), `blob_url` (text), `duration_ms` (int null), `format` (text null), `size_bytes` (bigint null), `created_at`. **Created now, populated in Phase 2.**
- `latency_spans` — `id`, `turn_id` fk, `stt_ms` (int null), `brain_ms` (int null), `reframe_ms` (int null), `tts_first_byte_ms` (int null), `total_ms` (int null), `created_at`.

Add FK indexes and the uniqueness constraints above. Keep the enum-like columns as `text` with a CHECK constraint (values come from a shared constant, not scattered literals) rather than Postgres enums, to keep migrations simple.

**Config.** None new beyond `DATABASE_URL`.

**Errors.** Runner is transactional per file; a failing file aborts and is not recorded in `schema_migrations`.

**Manual test.** On an empty DB: `npm run migrate` applies `0001`+`0002` (ledger shows both); re-running is a no-op; `\d` shows all tables.

**Done when.** Every TRD §5 table exists with keys/indexes/constraints, the single migration path is the only one (smoke uses it), and the manual test passes.

---

## Part 1.2 — Engram client wrapper (behind an interface)

**Goal.** All Engram access goes through one swappable Python interface in the worker; contracts from [TRD §3](TRD.md) enforced; SDK never touched elsewhere.

**Files.**
- `worker/src/worker/engram/__init__.py`
- `worker/src/worker/engram/interface.py` — an abstract base (Protocol/ABC) `PersonaBrain` defining the methods below (so the fallback/mocks can implement it).
- `worker/src/worker/engram/engram_brain.py` — concrete impl wrapping `EngramClient`.
- `worker/src/worker/engram/errors.py` — app-level error types mapping the taxonomy in §2.4.

**Logic — interface methods (thin, typed, per-user client):**
- `create_persona(name, handle, description) -> PersonaRecord`
- `get_persona(persona_id) -> PersonaRecord`
- `teach(persona_id, text)` / `answer(persona_id, question_key, text)` / `questions(persona_id)`
- `ingest_shared_document(persona_id, document, metadata=None)` and `ingest_shared_text(...)`
- `subscribe(persona_id, user_id)` / `unsubscribe(...)` / `subscribers(persona_id)`
- `chat(persona_id, message, session_id=None) -> ChatOutcome` where `ChatOutcome` is a small worker-owned dataclass: `messages: list[str]`, `text: str` (flattened; separator from config), `memories_used: list`, `session_id: str | None`, `raw: dict`, `brain_ms: int`.
- Construction uses `create_engram(settings, user_id)` — **one client per Engram user_id**; do not reuse one client across users.

**Contracts enforced (TRD §3):**
- Never build tenant strings; only use persona endpoints and read `.tenant`/`.id` off returned objects.
- `chat` always passes `session_id` through and returns the (possibly new) `session_id` for the caller to persist and reuse. Omitting it makes the persona amnesiac — the wrapper makes it impossible to forget by returning it explicitly.
- `retrieve` is available but **not** on the per-turn path.
- Map SDK exceptions → app errors: reads may retry on 429/502/503/504 (bounded, from config); **writes (`chat`, `teach`, `answer`, `ingest`, `subscribe`) are never blind-retried**. `ForbiddenError` on `chat` → a typed `NotSubscribedError`.
- Timeout comes from `ENGRAM_TIMEOUT_SECONDS` (already in config; generous default 120).

**Config.** `ENGRAM_API_KEY`, `ENGRAM_ORG_ID`, `ENGRAM_BASE_URL`, `ENGRAM_TIMEOUT_SECONDS` (present). New: `ENGRAM_MESSAGE_JOIN` (separator for flattening `messages`, default `" "`), `ENGRAM_READ_MAX_RETRIES` (int, default 2).

**Errors.** All raised as the app-level types from `errors.py`; callers never see `engram_sdk` exceptions.

**Manual test.** A throwaway script (`worker` `uv run` entry): create a temporary persona, `teach` one fact, `subscribe` a test user, `chat` a question referencing that fact, and confirm the reply is grounded (`memories_used` non-empty and the fact reflected in `messages`). Requires real Engram keys in `.env`.

**Done when.** Every method works against live Engram, contracts hold, the SDK is imported in no file other than the wrapper, and the manual test passes.

---

## Part 1.3 — Auth (Google OAuth) & user mapping

**Goal.** Users sign in with Google; each maps to a stable app user and an Engram `user_id`; per-user isolation is enforced on every request.

**Files.**
- `gateway/src/auth/google.ts` — OIDC via **fetch** (no Passport / no `openid-client`): read the discovery doc (`GOOGLE_OIDC_DISCOVERY_URL`) for `authorization_endpoint`, `token_endpoint`, `jwks_uri`; build the auth URL (state + nonce + PKCE); handle the callback: exchange `code` at `token_endpoint`, verify the `id_token` signature against JWKS and validate `iss`/`aud`/`exp`/`nonce`.
- `gateway/src/auth/session.ts` — session (D3): create a random session id, store `{app_user_id}` in Redis with TTL, set a signed HttpOnly SameSite cookie (`Secure` in production).
- `gateway/src/auth/users.ts` — upsert the app user from the verified id_token claims (`sub`, `email`) into `users`; assign `engram_user_id` per **D1**; on first login also `subscribe` the user to the active persona (via the worker/Engram) so `chat` won't 403.
- `gateway/src/routes/auth.ts` — `GET /auth/google` (redirect), `GET /auth/google/callback`, `POST /auth/logout`, `GET /api/me`.
- Auth guard/preHandler used by all `/api/*` routes; resolves the current app user from the session cookie or returns 401.

**Logic.**
- The callback path must equal `GOOGLE_CALLBACK_URL` exactly (`http://localhost:4000/auth/google/callback`).
- Verify the id_token cryptographically (fetch + cache JWKS); never trust unverified claims. No keyword logic anywhere.
- Isolation: every `/api/*` handler derives `app_user_id` from the session only, then looks up `engram_user_id`; a user can never pass another user's id. The worker call carries the server-resolved ids, never client-supplied identity.

**Config.** Present: Google keys, `SESSION_SECRET`. New (D3): `SESSION_COOKIE_NAME` (default `vb_session`), `SESSION_TTL_SECONDS` (default e.g. 604800), `SESSION_COOKIE_SECURE` (bool; false in dev, true in prod), `GOOGLE_SCOPES` (default `openid email profile`).

**Errors.** State/nonce mismatch, token exchange failure, id_token verification failure → 401 with a safe message; details logged server-side only. Never log tokens or secrets.

**Manual test.** Two different Google accounts sign in and get **distinct** `users` rows with distinct `engram_user_id`s; `GET /api/me` returns the right identity for each; logout clears the session; hitting `/api/*` without a cookie returns 401.

**Done when.** Sign-in/out works, id_token is verified, users map 1:1 to Engram ids, first-login subscription happens, and isolation holds.

---

## Part 1.4 — Persona admin (create & teach the single persona)

**Goal.** The owner can create the one persona and seed it (facts, question-bank answers, documents) and subscribe testers. Per **D4 = both CLI and UI**.

**Files.**
- `worker/src/worker/admin/seed.py` — argparse/typer CLI: `create-persona`, `teach`, `answer`, `list-questions`, `ingest-doc`, `subscribe`, `show`. Uses the Part 1.2 wrapper only.
- On create, persist the persona locally: insert into `personas` (`engram_persona_id`, `handle`, `display_name`, `description`, `voice_config`). `voice_config` is owner-provided JSON (spoken-style rules used by the reframe prompt) — **content, not code**.
- `worker/src/worker/api/admin.py` — internal admin endpoints (guarded by `INTERNAL_API_SECRET`) that back the UI, calling the same wrapper as the CLI (no duplicated Engram logic).
- Gateway `gateway/src/routes/admin.ts` — `/api/admin/*` routes guarded to the owner (owner check via `OWNER_EMAILS`), proxying to the worker admin endpoints.
- Frontend: a minimal admin screen on the component-library primitives to create/edit the persona (name, handle, description, voice_config), teach facts, answer question-bank items, upload/ingest a document to the shared pool, and subscribe testers.

**Logic.**
- The "active persona" is resolved from the `personas` table (single row for the first build); nothing about the persona is hardcoded in logic.
- Persona textual content (which historical figure, facts, documents, voice rules) is supplied by the owner at seeding time.

**Config.** Owner identity for admin authorization via config (`OWNER_EMAILS`), not a literal in code.

**Manual test.** Owner creates the persona, teaches a few facts + answers 1–2 question-bank items + ingests one document into the shared pool, subscribes a tester; `personas`/`subscriptions` rows exist; `personas.get` reflects the data.

**Done when.** The persona exists in Engram and in `personas`, is seeded, and at least one tester is subscribed.

---

## Part 1.5 — Reframe module

**Goal.** Turn an Engram reply into natural, spoken, first-person, **fact-locked** text. Model-driven; no keyword logic.

**Files.**
- `worker/src/worker/reframe/__init__.py`
- `worker/src/worker/reframe/reframer.py` — `reframe(messages: list[str], history: list[Turn], voice_config: dict) -> str` using the OpenAI client from `create_openai`.

**Logic.**
- Prompt = (a) the Engram reply bubbles (`messages`), (b) the last **N** turns of this session (from Postgres `turns`), (c) the persona voice rules (`personas.voice_config`). Instruction: paraphrase into natural spoken first-person; **do not add any fact not present in the Engram reply**; only minor connective phrasing; preserve meaning; no invented details.
- Fact-lock is enforced by the prompt/model, not by string comparison. There is **no** keyword/allow-list filtering of the output (that would be a heuristic and is forbidden). If the model is unavailable, the turn fails honestly (no fallback that fabricates).
- Deterministic-ish settings from config (temperature, max tokens). Model = `OPENAI_MODEL` (default `gpt-4o-mini`).

**Config.** Present: `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL`. New: `REFRAME_HISTORY_TURNS` (int N, default e.g. 8), `REFRAME_TEMPERATURE` (float), `REFRAME_MAX_TOKENS` (int).

**Errors.** OpenAI failure → typed error; the turn is reported as failed (Engram-down-style honesty), never silently dropped or faked.

**Manual test.** Given a canned `messages` list and a canned voice_config, the reframe returns a natural spoken version that introduces **no** new facts (checked by reading the output, not by code heuristics).

**Done when.** Reframe produces fluent, fact-locked spoken text from real `chat` output, fully config-driven, with no keyword logic.

---

## Part 1.6 — Controller (speak / silence gate)

**Goal.** Decide **speak vs silence** from the `chat` result and structured signals only. Output a small structured object. **No keyword/intent matching** (TRD §1.5, AGENTS §7).

**Files.**
- `worker/src/worker/controller/__init__.py`
- `worker/src/worker/controller/decision.py` — enums + dataclass:
  - `Action = Enum("speak", "silence")`
  - `ReasonCode = Enum(...)` (e.g. `HAS_GROUNDED_REPLY`, `EMPTY_REPLY`, `NOT_SUBSCRIBED`, `BRAIN_ERROR`) — enum values, not free-form strings.
  - `Decision(action, reasons: list[ReasonCode], hints: dict)`
- `worker/src/worker/controller/controller.py` — `decide(outcome: ChatOutcome | BrainError, signals: TurnSignals) -> Decision`.

**Logic (structured signals only):**
- Inputs: the `ChatOutcome` (does it contain any non-empty `messages`? is `memories_used` non-empty? was there an error and of what typed class?) and `TurnSignals` (e.g. whether the inbound user text was non-empty — a structural check on the request, not its content).
- Rule (structural, not linguistic): if `chat` produced deliverable content → `speak` with `HAS_GROUNDED_REPLY`; if it produced no messages → `silence` with `EMPTY_REPLY`; typed errors map to their reason codes and `silence`/honest failure. These branch on **result structure and enums**, never on the words inside the message.
- `hints` may carry pass-through info for the reframer/UI (e.g. bubble count). No keyword extraction.

**Config.** None linguistic. Any counts/thresholds (if introduced) come from config, but the recommended v1 needs none beyond emptiness checks.

**Errors.** A `BrainError` input yields a `silence`/failure `Decision` with the mapped reason code; the caller surfaces it honestly.

**Manual test.** Feed representative `ChatOutcome`s (normal grounded reply; empty messages; `NotSubscribedError`; `ServerError`) and confirm sensible `Decision`s with correct reason codes — with **no** string/keyword logic in the implementation (verify by reading the code).

**Done when.** `decide` returns correct structured decisions for all representative cases, provably free of keyword/intent heuristics.

---

## Part 1.7 — Text chat loop end-to-end

**Goal.** Wire user text → controller → `chat` → reframe → reply, with full persistence and one Engram `session_id` per session.

**Files.**
- Worker: `worker/src/worker/api/turn.py` — `POST /internal/turn`, guarded by `INTERNAL_API_SECRET` (header). Orchestrates: resolve persona, ensure session row, run controller pre-check → wrapper `chat` → controller `decide` → (if speak) reframe → persist. Register the router in `main.py`.
- Worker: `worker/src/worker/persistence/` — repository functions (psycopg) for `sessions`, `turns`, `memory_refs`, `latency_spans`. Upsert `engram_session_id` on the session after the first reply.
- Gateway: `gateway/src/routes/chat.ts` — `POST /api/chat` (auth-guarded): resolve app user + `engram_user_id` + active persona, resolve/create the app session, call the worker over `WORKER_URL` with `INTERNAL_API_SECRET`, return `{ action, reply_text, session_id }`.
- Gateway: `gateway/src/clients/worker.ts` — internal HTTP client (timeout, auth header).

**Logic.**
- One Engram `session_id` per app session: worker reads `sessions.engram_session_id`; passes it to `chat`; on the returned (possibly new) id, updates the session row. Redis holds only ephemeral operational state (e.g. an app-session→last-activity map with TTL) — **never** the source of conversational context (that is Engram + Postgres).
- Persist every turn: one `turns` row for the user text (`speaker=user`) and, when the controller says speak, one for the persona (`speaker=persona`, flattened `text` + raw `messages` + `controller_action`/`controller_reasons`); write `memory_refs` (`memories_used`) and `latency_spans` (`brain_ms`, `reframe_ms`, `total_ms`). Ordinals are monotonic per session.
- Identity is always server-resolved; the worker trusts only ids signed by the gateway call (internal secret), never client-supplied identity.

**Config.** Present: `WORKER_URL`, `INTERNAL_API_SECRET`. New: `WORKER_HTTP_TIMEOUT_MS` (gateway→worker timeout).

**Errors.** Engram/reframe failures propagate as honest errors to the UI (no fabricated replies — TRD §7). Writes are not blind-retried. 401 on missing/invalid internal secret.

**Manual test.** A multi-turn typed conversation in one session where the persona recalls something said earlier in the **same** session; Postgres shows correctly-ordered `turns`, `memory_refs`, `latency_spans`, and a single stable `engram_session_id` on the session.

**Done when.** The full text loop works with persistence and stable session threading, identity is server-enforced, and the manual test passes.

---

## Part 1.8 — Chat UI + memory-across-restart proof

**Goal.** A usable typed chat UI on the component library that proves persistent memory across a process restart.

**Files.**
- Frontend: a chat route/screen built on the existing component-library primitives (`frontend/src`), design tokens/CSS already load via `frontend/src/main.tsx` (do not add component-level CSS imports). Persona header, transcript list, input box, send; sign-in gate using `/api/me`; calls `POST /api/chat` with the session cookie (credentials included; CORS origin already set to `FRONTEND_ORIGIN`).
- Session continuity: the frontend keeps the app `session_id` returned by `/api/chat` for the conversation; resume uses the stored session so its `engram_session_id` is reused after a restart.

**Logic.**
- The UI shows the flattened reply text (bubbles may be rendered as the `messages` list if desired). No client-side persona logic.
- Auth-gated: unauthenticated users see the Google sign-in entry.

**Config.** Frontend uses `VITE_GATEWAY_URL` (present).

**Manual test (the Phase 1 acceptance).** Hold a conversation; **restart the worker process** (and gateway if needed); resume the same session; confirm the persona still remembers earlier turns (memory lives in Engram + Postgres, not process memory). Confirm two different signed-in users cannot see each other's transcripts.

**Done when.** A signed-in user holds a grounded typed conversation, memory survives a restart (proven live), isolation holds. **Phase 1 done.**

---

## 5. Cross-cutting definition of done for Phase 1

- No hardcoded product values; no keyword/intent heuristics anywhere (controller, reframe, auth). Verified by reading the code.
- Engram SDK imported only inside the Part 1.2 wrapper; everything else uses the interface.
- One migration path/ledger; schema matches TRD §5.
- Identity/isolation enforced server-side on every request.
- Engram/LLM failures are honest (no fabricated replies); writes never blind-retried.
- Each part's manual test passes and is shown to Tauqueer before any commit (commits only on his word). Commit messages must not cite phase or part numbers.
