# Phase 3 build plan — Hardening, dashboard, and Azure

Detailed, implementation-level plan for Phase 3. Owner: Tauqueer. Read [AGENTS.md](../AGENTS.md), [PRD.md](PRD.md), and [TRD.md](TRD.md) first. This document expands [PHASE_PLAN.md](PHASE_PLAN.md) Phase 3 and supersedes its part numbering — the dashboard was added and the order was changed to match what Tauqueer wants first.

> Phase 3 goal: the product survives its dependencies failing, can be watched and understood from a UI instead of `psql`, is safe to put in front of testers, and runs on Azure instead of a laptop with a tunnel.

**Status: 3.1–3.8 implemented.** Click-through of owner vs tester and a second Google OAuth sign-in still belong to Tauqueer. Remaining parts start when Tauqueer names one.

---

## 0. How to use this document

- Build **one part at a time**, only when Tauqueer names it. Each part has: **Goal**, **Files**, **Logic**, **Config**, **Errors**, **Manual test**, **Done when**.
- **Do not mention phase numbers or part numbers** in commit messages, code comments, or PR titles.
- **Ground truth for current behavior is the code.** This file is intent plus the locked wiring.
- **Hard rules ([AGENTS.md](../AGENTS.md) §7):** no hardcoded product values; no keyword/intent matching; no "TODO later" holes in a finished part. Every threshold, page size, range and label is config.
- **UI rule carried from Phase 2:** build on the copied component library. **No new CSS files** — `app-shell.css` and `dashboard.css` are already imported by `main.tsx` in the documented order. If a style does not exist, add it to an existing file or use the primitives.

### Ordering

Tauqueer's priorities are failure handling and observability, then the security pass, then Azure. Multilingual and voice cloning come last. The dashboard is new and sits early because it is how everything after it gets watched.

| Order | Part | Why here |
| --- | --- | --- |
| 3.1 | Failure handling | Nothing else is trustworthy until outages behave honestly |
| 3.2 | Read API for the canonical record | The dashboard cannot exist without it |
| 3.3 | App shell & navigation | Two frames: personal app and `/admin` |
| 3.4 | Admin overview — health & latency | The "is it healthy and fast" view |
| 3.5 | Admin conversations & people | The "what happened in that call" view |
| 3.6 | Personal home | History, spoken transcript, memory panel |
| 3.7 | Observability & latency budgets | Traces and regression alerting behind the UI |
| 3.8 | Security & isolation review | Before anyone else uses it |
| 3.9 | Azure deployment | Off the laptop; kills the tunnel; audio storage switches on |
| 3.10 | Multilingual (code-switch) | Deferred capability |
| 3.11 | Voice-clone groundwork | Deferred capability |
| 3.12 | Productionization polish | Last pass |

---

## 1. What already exists (Phases 0–2 — do not rebuild)

| Area | Where | State |
| --- | --- | --- |
| Auth + per-user isolation | `gateway/src/auth/` | Google OIDC, Redis-backed cookie session. `createRequireAppUser` (401) and `createRequireOwner` (403, `OWNER_EMAILS`) guards exist and are used. |
| Typed chat | `/api/chat`, `frontend/src/app/chat/ChatPage.tsx` | Working. |
| Voice call | `/ws/voice`, `frontend/src/app/voice/VoicePage.tsx` | Working: mic capture, streamed reply, barge-in, live transcript, VU, thinking cue. |
| Brain | `worker/src/worker/turn/service.py` | One `TurnRunner`. `BRAIN_MODE` selects `retrieve` (default) or `chat`. Streams the reply; `converse` write-back off the reply path. |
| Persona admin | `/admin/persona`, `frontend/src/app/admin/AdminPage.tsx` | Owner-only: create/edit persona, teach, answer question bank, ingest documents, subscribe testers. Lives in the admin shell. |
| Canonical record | Postgres | `users`, `personas`, `subscriptions`, `sessions`, `turns`, `memory_refs`, `audio_assets`, `latency_spans`. See §3. |
| Product UI | `/`, `/dashboard`, `/chat`, `/voice`, `/admin` | Landing and sign-in at `/`. Personal app at `/dashboard`. Admin app at `/admin`. |
| Component library | `Desktop/component-library` | Reference only. Copy a primitive into `frontend/` when a part needs it. The gallery and unused showcase files are not in this repo. |
| Probes | `package.json` | `smoke`, `controller`, `reframe`, `chat`, `byo`, `brains`, `voice`, `call`, `audio`, `bargein`, `isolation`, `failures`, `nav`, `budgets`, `security`. |

---

## 2. Locked decisions (Phase 3)

Settled with Tauqueer before this plan was written. Do not silently change them.

- **D13 — The personal app is the same for every signed-in user.** `/dashboard`, `/chat` and `/voice` do not change with `OWNER_EMAILS`. Role comes from the server (`/api/me.owner`). An owner sees one extra personal-nav item that opens `/admin`.
- **D14 — Admin is a separate owner-only app.** `/admin` has its own shell (Overview, Conversations, People, Persona). It does not fold into `/dashboard`. Signed-in non-owners are bounced to `/dashboard`; the server still returns 403.
- **D15 — The app shell is the library's.** `AppShell` + `Sidebar` + `TopBar` wrap both the personal app and the admin app. Personal nav is one config list; admin nav is another; the owner Admin entry is a third config list.
- **D16 — Conversation views are read-only.** They never edit turns and never chat as another user. Persona teaching stays on the Persona tab. The personal memory panel is a retrieve of the signed-in user's own pool, not an answer on someone else's behalf.
- **D17 — Azure shape is Container Apps.** Three container apps (gateway, worker, frontend), Azure Database for PostgreSQL, Azure Cache for Redis, Azure Blob for audio. The worker gets a real public URL, which retires the ngrok dependency in `BYO_LLM_PUBLIC_URL`.
- **D18 — Blob audio switches on at deployment.** `VOICE_AUDIO_PERSIST_ENABLED` stays `false` until part 3.9 provisions a storage account. The capture, WAV and turn-binding code is already built and tested against the emulator.
- **D19 — No new brains.** Phase 3 does not add another Engram path. `BRAIN_MODE` stays as it is; the dashboard reports on both.

---

## 3. The canonical record the dashboard reads

Everything below already exists and is populated. No migration is needed for parts 3.2–3.6 unless a part says so. Part 3.7 adds `turns.correlation_id` (`infra/migrations/0005_correlation_id.sql`).

```
users(id, google_sub, email, engram_user_id, created_at, updated_at)
personas(id, engram_persona_id, handle, display_name, description, voice_config, ...)
subscriptions(id, user_id, persona_id, status, created_at)
sessions(id, user_id, persona_id, engram_session_id, channel, started_at, ended_at)
turns(id, session_id, ordinal, speaker, text, messages, controller_action,
      controller_reasons, stt_meta, tts_meta, brain_mode, correlation_id, created_at)
memory_refs(id, turn_id, memories_used, engram_session_id, created_at)
audio_assets(id, turn_id, direction, blob_url, duration_ms, format, size_bytes, created_at)
latency_spans(id, turn_id, stt_ms, brain_ms, reframe_ms, reframe_first_token_ms,
              tts_first_byte_ms, total_ms, transport_latency, created_at)
```

Notes that matter when querying:

- `channel` is `text` or `voice`; both live in the same tables.
- `brain_mode` is `retrieve`, `chat`, or NULL for turns recorded before it existed. Any A/B view must handle NULL.
- `correlation_id` is NULL on turns recorded before the observability migration. Admin reconstruct hides the field when it is null.
- `latency_spans` attaches to the **persona** turn when the turn spoke, and to the user turn when it stayed silent.
- `reframe_first_token_ms` is when speech could start — the number to show as "time to first word", not `total_ms`.
- `transport_latency` is JSONB holding the transport's own breakdown (`ttt_text_latency`, `tts_latency`, `total_latency`, sometimes `stt_latency`).
- `audio_assets` is empty until 3.9. Every view must render cleanly with no audio.
- **Isolation is on `sessions.user_id`.** Every non-owner query joins through `sessions` and filters on it. There is no other gate — Engram is not refusing anyone (see §7).

---

## 4. Component inventory

Reference: `Desktop/component-library`. That project is the gallery. This repo only keeps what the voice bot renders. When a later part needs a chart or primitive that is not here, copy that file from the library into `frontend/src`.

**In this repo now** (`frontend/src/components/`): `Badge`, `Button`, `Card`, `Input`, `Meter` (`BarMeter`), `Avatar`, `Grainient`, `RadialMenu`, `Segmented`, `Section`, `KpiStrip`, `useCornerNotch`, `ActivityGraph`, `NodeSparkline`, icons, plus the wired `AppShell` / `Sidebar` / `TopBar`.

Mapping to real data (parts 3.4–3.6):

| Component | Shows |
| --- | --- |
| `KpiStrip` | calls, turns, median time to first word, error rate |
| `ActivityGraph` / `MemoryActivity` | turns or calls over the selected range |
| `ActivityCalendar` | days with activity |
| `RecentActivity` | latest calls, drill into transcript |
| `NodeSparkline` | latency trend per stage |
| `MemoryComposition` | shared vs private grounding, or brain-mode split |
| `RecallHeatmap` | latency or activity by hour/day |
| `Segmented` | range switch (`today` / `7d` / `30d` — ids already exist) |
| `Meter` / `BarMeter` | p50 against the configured budget |

`ConnectorList`, `QuickCapture`, `Composer` and `QuickActions` are demo pieces. Reuse only if they fit something real; otherwise drop them rather than inventing a feature to justify them.

---

## Part 3.1 — Failure handling

**Goal.** Every dependency can fail without the product lying about it.

**Files.**
- `gateway/src/routes/voice.ts` — client-facing error taxonomy and reconnect.
- `gateway/src/deepgram/agent.ts` — reconnect attempt on transport close.
- `frontend/src/app/voice/VoicePage.tsx`, `frontend/src/app/chat/ChatPage.tsx` — honest states.
- `worker/src/worker/turn/service.py`, `worker/src/worker/api/chat_completions.py` — failure paths already map `TurnError`; extend where a failure is currently only logged.

**Logic.** Behaviour per dependency, from [TRD](TRD.md) §7:

| Fails | Behaviour |
| --- | --- |
| Engram | Product down. The caller is told plainly; nothing is fabricated. The turn is recorded with the controller's silence reason. |
| Deepgram | Session ends, one reconnect attempt (count and backoff from config), then an honest end. |
| Speaking LLM | Already handled mid-stream: the caller hears only what was produced, the partial is persisted, the failure is logged. Surface it in the UI rather than ending in silence. |
| Postgres | The reply still goes out; the record is lost and loudly logged. `_finish` already catches this — it must also surface, not just log. |
| Blob | Already non-fatal (Phase 2). Warning to the client, call continues. |
| Redis | Call state is ephemeral; a failure must not end a call. Verify. |

Rules: no blind write retries (TRD §3). Reads may retry on 429/502/503/504, which `EngramBrain._read` already does. No fabricated replies to cover a failure — D11 from Phase 2 still holds.

**Config.** `DEEPGRAM_RECONNECT_ATTEMPTS`, `DEEPGRAM_RECONNECT_BACKOFF_MS`, and client-facing error type strings (the `VOICE_CLIENT_*_TYPE` family already exists).

**Errors.** This part *is* the error handling. Nothing may be swallowed.

**Manual test.** `npm run failures` — taxonomy, reconnect rules, Redis timeout, and the worker turn runner against a real session. Live outages (dead Engram host, dropped tunnel, Redis stopped mid-call) are optional; the probe is the accepted gate. **Done.**

**Done when.** `npm run failures` passes and each row in §7 is implemented in code.

---

## Part 3.2 — Read API for the canonical record

**Goal.** The gateway can serve everything the dashboard needs, correctly scoped, without the browser ever touching Postgres shapes it should not see.

**Files.**
- `gateway/src/routes/insights.ts` (new) — the read endpoints.
- `gateway/src/insights/queries.ts` (new) — the SQL, one function per view.
- `gateway/src/insights/types.ts` (new) — response shapes shared with the frontend.
- `gateway/src/routes/memories.ts` — personal memory panel proxy.
- Register in `gateway/src/app.ts`.

**Logic.** Two families, two guards.

*Personal (any signed-in user, `requireAppUser`):*
- `GET /api/me/overview` — counts and last activity for **this user**.
- `GET /api/me/sessions?range=&cursor=` — their calls and chats, newest first.
- `GET /api/me/sessions/:id` — one session: ordered turns, per-turn timings, audio when present. 404 if it is not theirs. Never 403 with detail — do not confirm another user's session exists.
- `GET /api/me/memories` — retrieve as this user (`gateway/src/routes/memories.ts`). Off when `MEMORY_PANEL_ENABLED` is not `true`.

*Owner (`requireAppUser` + `requireOwner`):*
- `GET /api/admin/overview?range=` — system counts, median and p90 time to first word, error rate, brain-mode split.
- `GET /api/admin/activity?range=&bucket=` — a time series for the graphs.
- `GET /api/admin/latency?range=` — per-stage p50/p90, split by `brain_mode`.
- `GET /api/admin/sessions?range=&user_id=&channel=&cursor=` — all sessions with filters.
- `GET /api/admin/sessions/:id` — any session, same shape as the personal one.
- `GET /api/admin/users` — users with call counts and last seen.

Rules:
- Personal queries **always** join `sessions` and filter `sessions.user_id = :me`. No exceptions, no "owner sees all" shortcut inside a personal endpoint — the owner uses the admin endpoints.
- Percentiles in SQL (`percentile_cont`), not in JS over a fetched list.
- Cursor pagination, page size from config, capped.
- `range` is validated against a configured allow-list; an unknown range is a 400, not a silent default.
- Turn text is returned as stored. No truncation server-side; the UI decides.

**Config.** `INSIGHTS_PAGE_SIZE` (default 50), `INSIGHTS_MAX_PAGE_SIZE`, `INSIGHTS_RANGES` (`today,7d,30d`), `INSIGHTS_DEFAULT_RANGE`, `LATENCY_BUDGET_FIRST_WORD_MS` (used by 3.4 and 3.7).

**Errors.** 401 unauthenticated, 403 on admin endpoints for a non-owner, 404 for a session that is not yours, 400 for an invalid range or cursor.

**Manual test.** `npm run isolation`: a non-owner gets 403 on every `/api/admin/*` endpoint, sees only their own sessions on `/api/me/*`, and gets 404 for another user's session id. Numbers from `/api/admin/overview` match the SQL. **Done.**

**Done when.** Every number the dashboard will show can be fetched from an endpoint, and the isolation probe covers the admin surface.

---

## Part 3.3 — App shell & navigation

**Goal.** Two navigation frames: the personal app for everyone, and `/admin` for the owner.

**Files.**
- `frontend/src/app/shell/AppShell.tsx`, `Sidebar.tsx`, `TopBar.tsx`, `ProductFrame.tsx`, `AdminFrame.tsx`.
- `frontend/src/Root.tsx` — personal vs admin vs landing.
- `frontend/src/lib/routes.ts`, `nav.ts` — two nav configs plus an owner-only Admin entry.
- `frontend/src/app/admin/AdminPage.tsx` — Persona tab body, behaviour unchanged.

**Logic.**
- Personal sidebar is the same for every signed-in user. The owner extra item opens `/admin`.
- `/admin` is its own shell. Testers who open it are bounced to `/dashboard`.
- Sign-in state, persona name and account live in `TopBar`.
- No new CSS files.

**Config.** `VITE_NAV_ITEMS`, `VITE_NAV_OWNER_ITEMS`, `VITE_ADMIN_NAV_ITEMS`.

**Errors.** Signed-out users get the sign-in card, not a broken shell.

**Manual test.** `npm run nav` checks the configured lists. **Done.** Sign-in click-through: owner sees Home, Chat, Voice, plus Admin; `/admin` has Overview, Conversations, People, Persona. Tester sees only Home, Chat, Voice; `/admin` bounces home. Persona forms still work. That click-through still belongs to Tauqueer.

**Done when.** Every product screen is in the personal shell and `/admin` is a standalone owner app. **Implemented.**

---

## Part 3.4 — Admin overview: health & latency

**Goal.** Answer "is it healthy, and is it fast" without opening `psql`.

**Files.**
- `frontend/src/app/admin/OverviewPage.tsx`.
- `frontend/src/lib/insights.ts` — typed fetch helpers for 3.2.

**Logic.**
- `KpiStrip`: calls, turns, **median time to first word**, error rate. Empty range is empty, never a fake 0%.
- `Segmented` range switch driving every panel from one piece of state.
- `ActivityGraph` for turns over the range.
- Latency panel: p50/p90 per stage, **split by `brain_mode`**. Handle unrecorded as configured.
- `BarMeter` showing p50 against `LATENCY_BUDGET_FIRST_WORD_MS`.

**Config.** `VITE_INSIGHTS_DEFAULT_RANGE`, `VITE_LATENCY_BUDGET_FIRST_WORD_MS`.

**Errors.** A failed fetch shows an error card and a retry.

**Manual test.** `npm run isolation` includes `owner_overview_matches_sql` and `owner_latency_ok`. **Done.** Hold two calls, one in each `BRAIN_MODE`, and confirm the overview split matches `npm run brains` — that live click-through still belongs to Tauqueer.

**Done when.** The numbers are right, the range switch works, and no mock data remains. **Implemented.**

---

## Part 3.5 — Admin conversations & people

**Goal.** Find any conversation and read exactly what happened in it.

**Files.**
- `frontend/src/app/admin/ConversationsPage.tsx`
- `frontend/src/app/admin/PeoplePage.tsx`
- `frontend/src/app/dashboard/Transcripts.tsx` — full reconstruct for admin.

**Logic.**
- Conversations list: user, channel badge, start, duration, turn count, whether it ended. Filters by range, channel and user. Cursor paging.
- Session detail: full reconstruct (turns, controller, timings, memory refs, audio when present). The correlation id is shown here only (added with 3.7); the personal spoken transcript does not.
- People: users with call counts, last seen, and subscription state — labelled so subscription is not an access gate.
- Persona: existing admin screen at `/admin/persona`.

**Config.** Page sizes and filter options from the read API. Channel and action labels from config.

**Errors.** A session that vanishes mid-view shows a clear message.

**Manual test.** Pick a call from a live test, open it, and confirm the transcript matches what was actually said, the timings match `latency_spans`, and the controller reasons are shown. The reconstruct UI is in; that live match still belongs to Tauqueer.

**Done when.** A call can be reconstructed in the UI as completely as the SQL reconstruction. **Implemented.**

---

## Part 3.6 — Personal home

**Goal.** Every signed-in user sees their own history and what the persona knows about them.

**Files.**
- `frontend/src/app/dashboard/PersonalHome.tsx`
- Spoken transcript (text/speakers/audio only) against `/api/me/*`.
- `GET /api/me/memories` → worker `personas.retrieve` as that user.

**Logic.**
- Their calls and chats, newest first.
- One session's spoken transcript — not the admin reconstruct.
- Memory panel: retrieve as the signed-in `engram_user_id`. Never another user's pool, never a hand-built tenant.
- No system metrics, no other users.

**Config.** `MEMORY_PANEL_QUERY`, `MEMORY_PANEL_TOP_K`, `VITE_MEMORY_PANEL_ENABLED`.

**Errors.** Engram unavailable degrades the memory panel only — the history still renders.

**Manual test.** `npm run isolation` covers the read API (non-owner 404 on another user's session, lists scoped to `sessions.user_id`). **Done.** Two-account browser click-through still belongs to Tauqueer.

**Done when.** A member has something useful and cannot see anyone else. **Implemented.**

---

## Part 3.7 — Observability & latency budgets

**Goal.** A turn can be traced end to end, and a latency regression is noticed without someone looking.

**Files.**
- `infra/migrations/0005_correlation_id.sql` — `turns.correlation_id`.
- `gateway/src/routes/chat.ts`, `gateway/src/routes/voice.ts`, `gateway/src/voice/notices.ts` — mint, carry, and log the id.
- `gateway/src/observe/fields.ts`, `gateway/src/observe/budgetProbe.ts` — allow-list and budget check.
- `worker/src/worker/turn/service.py`, `worker/src/worker/api/turn.py`, `worker/src/worker/api/chat_completions.py`, `worker/src/worker/persistence/turns.py`, `worker/src/worker/notices.py` — bind, persist, log, and (for voice) publish the id.
- `worker/src/worker/observe/fields.py`, `worker/src/worker/observe/probe.py` — allow-list and Engram `insights.logs`.
- `frontend/src/app/dashboard/Transcripts.tsx` — admin reconstruct only.

**Logic.**
- One id per turn, present in gateway logs, worker logs and the stored row, so a log line and a database row can be joined. User and persona rows for the same exchange share it.
- Typed chat: the gateway mints the id, sends it on `CORRELATION_ID_HEADER` to `POST /internal/turn`, and logs the allow-listed fields after the worker returns (including `turn_ids` when present).
- Voice: Deepgram does not forward a per-turn header. The worker mints the id when the header is missing. After a successful persist it publishes a Redis notice with `kind=VOICE_NOTICE_KIND_TRACE`. The gateway logs that notice and does not send it to the caller.
- The worker binds `correlation_id` and `session_id` on structlog contextvars for the turn and writes an allow-listed turn event in `finish()`.
- Log fields are an allow-list (`LOG_TURN_FIELDS`). Boot fails unless that list includes `correlation_id` and `session_id`. Transcript `text` is omitted unless it is listed.
- Budgets: SQL `percentile_cont` p50/p90 of time to first word over `LATENCY_BUDGET_WINDOW_HOURS`, grouped by stored `brain_mode`. Per-mode numbers come from `LATENCY_BUDGET_BY_BRAIN_MODE` (lookup by the stored string). A mode missing from that map uses `LATENCY_BUDGET_FIRST_WORD_MS` / `LATENCY_BUDGET_P90_MS`. A breach fails `npm run budgets`. The product call path never reads these budgets.
- Review Engram `insights.logs` (org client, `GET /orgs/{org}/logs`) for rows whose structured `result` is `ENGRAM_LOG_RESULT_DENIED` or `ENGRAM_LOG_RESULT_ERROR`. Metadata only; no bodies. Unset Engram or `403 audit:read` is `SKIP`. Other Engram errors fail the probe.

**Config.** `LATENCY_BUDGET_FIRST_WORD_MS`, `LATENCY_BUDGET_P90_MS`, `LATENCY_BUDGET_WINDOW_HOURS`, `LATENCY_BUDGET_BY_BRAIN_MODE`, `CORRELATION_ID_HEADER`, `LOG_TURN_FIELDS`, `LOG_TURN_EVENT`, `VOICE_NOTICE_KIND_TRACE`, `VOICE_NOTICE_TRACE_CODE`, `VOICE_NOTICE_TRACE_MESSAGE`, `ENGRAM_LOGS_LIMIT`, `ENGRAM_LOG_RESULT_DENIED`, `ENGRAM_LOG_RESULT_ERROR`, `VITE_CORRELATION_LABEL`.

**Errors.** The budget check reports; it never changes behaviour on its own.

**Manual test.** `npm run budgets` against recent turns (pass). Force a fail with `LATENCY_BUDGET_BY_BRAIN_MODE='{}'` and `LATENCY_BUDGET_FIRST_WORD_MS` / `LATENCY_BUDGET_P90_MS` set below the measured values (`{}` is required: an empty string is treated as unset and reloads the default map). Engram `insights.logs` is reviewed in the same command (`SKIP` if the key cannot read org logs). **Done.**

**Done when.** A single turn is traceable from log to row, and a regression is detectable by running one command. **Implemented.**

---

## Part 3.8 — Security & isolation review

**Goal.** Confirm the safety posture before anyone outside the team uses it.

**Files.**
- `gateway/src/observe/securityProbe.ts`, `worker/src/worker/observe/security.py` (new).
- `gateway/src/voice/isolationProbe.ts` — CORS, `/api/me` shape, 404/403 logs, URL tamper body, rate-limit active.
- `gateway/src/auth/owner.ts`, `gateway/src/routes/insights.ts`, `gateway/src/routes/chat.ts` — refusal logs.
- `gateway/src/routes/auth.ts` — `/api/me` omits Engram and Google ids.
- `gateway/src/config.ts` — `SESSION_COOKIE_SAMESITE=none` requires a secure cookie; rate-limit keys.
- `gateway/src/app.ts` — register the per-IP rate limiter.
- `gateway/src/routes/memories.ts` — send `app_user_id` so the worker can bind identity.
- `worker/src/worker/api/memories.py`, `worker/src/worker/turn/service.py` — memory panel identity match.
- `worker/src/worker/ratelimit.py` (new), `worker/src/worker/api/internal_auth.py` — internal-secret brute-force throttle.
- `worker/src/worker/main.py`, `worker/src/worker/config.py` — OpenAPI off unless `WORKER_OPENAPI_ENABLED`; rate-limit keys; close the throttle client.
- `worker/src/worker/api/http.py` — 401/403 turns are logged.
- `docs/TRD.md` §7 — recorded answers.

**Logic.** Recorded answers:
1. Per-user isolation — `npm run isolation` covers typed chat, personal `/api/me/sessions/:id` (404, same body as missing, no owner email), admin 403, session list scoped to the signed-in user. The SPA dashboard uses that personal API, so URL tampering cannot read another user's conversation.
2. **Engram subscription** — accepted as not an access gate. The API key still lacks `org:manage`, so `personas.subscribe` stays 403 and the `subscriptions` mirror stays empty. An app-only subscription table would not stop Engram `chat`/`retrieve`/`converse`. Isolation stays `sessions.user_id` plus `TurnRunner` identity match. People UI copy already says subscription is visibility, not a gate.
3. Secrets — only `VITE_*` is typed for the browser. `/api/me` does not return `engram_user_id` or `google_sub`. Turn logs are an allow-list (`LOG_TURN_FIELDS`).
4. Cookie httpOnly + signed + SameSite from config; Secure follows production unless overridden. CORS origin is `FRONTEND_ORIGIN` with credentials. Internal secret on every worker product route except `/health`.
5. Public think URL — POST without the secret is 401 (SKIP if the tunnel is down or returns non-JSON). Local TestClient: missing/wrong secret 401, forged Engram id 403, other user's session 403. Live `npm run byo` still covers a full brain turn.
6. Audit trail — `turns.session_id` FK to `sessions`, `sessions.user_id` NOT NULL. Probe fails if orphan turns exist.
7. Memory panel — `/internal/memories` requires `app_user_id` and re-verifies the stored Engram mapping (403 on mismatch), matching the turn path, so a valid internal secret alone can never read another user's private pool. `npm run security` covers `memories_unauth` (401) and `memories_forged_engram_id` (403).
8. Rate limiting — the gateway rate-limits every request per client address (Redis-backed, fails open; `npm run isolation` asserts the limiter is active). The worker throttles repeated internal-secret failures per client address, returning 429 over the limit; only failed authentications are counted, so legitimate Deepgram/gateway traffic is never throttled even behind a shared address. `npm run security` asserts the throttle returns 429 (SKIP when Redis is unreachable).
9. Ingress (deployment) — in production the worker's `/internal/*` routes are gateway-only (private ingress); only the think path stays public. Implemented in §3.9.
10. CSRF — the production frontend stays same-site with the gateway, so `SameSite=lax` holds and no separate CSRF token is required.

**Config.** Existing cookie/CORS keys. `WORKER_OPENAPI_ENABLED` (default false). Gateway: `RATE_LIMIT_ENABLED`, `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_REDIS_PREFIX`. Worker: `RATE_LIMIT_ENABLED`, `RATE_LIMIT_REDIS_PREFIX`, `INTERNAL_AUTH_MAX_FAILURES`, `INTERNAL_AUTH_FAILURE_WINDOW_SECONDS`.

**Errors.** Findings are fixed or written into [TRD.md](TRD.md) §7. The remaining Tauqueer click is a brand-new Google OAuth in a browser, not a code hole.

**Manual test.** `npm run isolation` and `npm run security`. Cross-user access from a second real app account and a crafted think-endpoint request are refused and logged. **Done.**

**Done when.** Every item above has a recorded answer. **Implemented.**

---

## Part 3.9 — Azure deployment

**Goal.** The product runs on Azure. The tunnel is gone. Audio is stored.

**Files.**
- `gateway/Dockerfile`, `worker/Dockerfile`, `frontend/Dockerfile` (new).
- `infra/azure/` — Container Apps definitions, or Bicep/Terraform if Tauqueer prefers.
- CI/CD workflow.
- `.env.example` — a documented production profile.

**Logic (D17).**
- Three container apps: gateway, worker, frontend.
- Azure Database for PostgreSQL and Azure Cache for Redis, private where possible.
- Azure Blob for audio: provision the account and container, set the three `AZURE_*` keys, and **turn `VOICE_AUDIO_PERSIST_ENABLED` on** (D18). `AZURE_BLOB_ENDPOINT` stays unset in production — it exists for emulator and sovereign-cloud use.
- The worker gets a public URL; `BYO_LLM_PUBLIC_URL` points at it and ngrok is retired. Only the think path is public: the `/internal/*` routes (turn, memories, admin) are reachable only from the gateway (private ingress / internal networking), so the shared internal secret is not the sole boundary in production (decision from §3.8).
- Migrations run as a deployment step, forward-only, using the existing runner.
- Secrets from Azure config, never baked into images.

**Config.** A production profile for every existing key. Nothing new invented; the same schemas must validate.

**Errors.** A failed migration stops the deploy. A missing required key fails fast at boot, as it already does.

**Manual test.** A staging deployment serves a full voice conversation from a browser, with audio landing in Blob and both blobs fetchable. Run `npm run smoke` against staging — Azure should report `OK` rather than `SKIP` for the first time.

**Done when.** A call works end to end on Azure, audio is stored, and no laptop is involved.

---

## Part 3.10 — Multilingual (code-switch)

**Goal.** The caller can switch languages mid-sentence.

**Logic.** Move the listen provider to `language=multi` with endpointing tuned for code-switch (TRD §4 notes ~100ms rather than ~300ms). Config, not a code branch. Verify Nova-3 supports the combination at the time of building — and note that Nova-3 `v1` exposes no endpointing parameter inside Voice Agent Settings (Phase 2 §8), so check whether the knob exists before planning around it.

**Manual test.** A code-switched utterance is transcribed and answered correctly.

**Done when.** Switching the configured language changes behaviour with no code change.

---

## Part 3.11 — Voice-clone groundwork

**Goal.** Per-persona voices, and a path to a cloned one.

**Logic.** `personas.voice_config` already exists and already reaches the speaking prompt. Extend it to carry the TTS voice id so the voice is a property of the persona rather than one global config value. Cloning itself stays out of scope; leave the seam.

**Manual test.** Changing a persona's configured voice changes the spoken output.

**Done when.** Voice is per-persona and the clone integration point is documented.

---

## Part 3.12 — Productionization polish

**Goal.** The last pass.

**Logic.** Rate limits on the public surfaces, idempotency for writes, retry policy aligned with Engram's guidance, dependency pinning, and a final documentation sync so the docs match the deployed system.

**Manual test.** Load and robustness spot checks pass. **Phase 3 done.**

---

## 5. Cross-cutting definition of done for Phase 3

- Every new value is config; no magic numbers, no duplicated strings.
- No keyword or intent heuristics anywhere, including in the dashboard's grouping and labelling.
- Isolation is enforced **server-side** on every read path; UI filtering is never the control.
- No new CSS files; the component library is the reference, not a runtime dependency.
- Each part's manual test is shown to Tauqueer before any commit.
- Docs updated in the same commit as the behaviour they describe.

---

## 6. Carried over from Phase 2

Open items inherited by this phase, all recorded in [PHASE_2_PLAN.md](PHASE_2_PLAN.md) §9:

1. **A second Google account sign-in** has still not been done in a browser. Isolation is proven with two real Google-mapped users via signed cookies (`npm run isolation`). The OAuth redirect path after Google's callback is the same code. Recorded; not a product hole. The live click still belongs to Tauqueer.
2. **Blob audio archiving is off** (`VOICE_AUDIO_PERSIST_ENABLED=false`) until 3.9 provisions storage.
3. **The Engram API key lacks `org:manage`**, so `personas.subscribe` returns 403 and the `subscriptions` mirror stays empty. **Accepted.** Do not gate product access on that table. Pursue `org:manage` later only if admin wants a live subscription mirror.
4. **Engram does not gate access on subscription** — an unknown user id was allowed `chat`, `retrieve` and `converse`. **Confirmed and accepted.** Isolation is `sessions.user_id` plus `TurnRunner` refusing a mismatched identity (403). Private pools stay scoped per Engram `user_id`.
5. **`BRAIN_MODE=chat` is kept as a switch.** If `retrieve` holds up over real use, consider removing the second path in 3.12 rather than maintaining both forever.

---

## 7. Failure handling — what the caller sees

Proved by `npm run failures` (taxonomy + Redis timeout + worker turn runner).

| Dependency | What happens | What the caller sees |
| --- | --- | --- |
| Engram | Product down. Silence is recorded with the controller reason. A Redis notice ends the voice call. Chat returns 503. | "The persona's memory is unavailable. Nothing was invented in its place." |
| Deepgram | One reconnect (`DEEPGRAM_RECONNECT_ATTEMPTS`, backoff from config). `FAILED_TO_THINK` does not reconnect. | While retrying: "The voice connection dropped. Reconnecting…". If it cannot come back: "The voice connection could not be restored." If think is exhausted: "The persona could not answer. The call has ended." |
| Speaking LLM | Whatever words were produced stay. The partial is persisted. The call continues. | "The reply stopped early. You heard only the words that were produced." |
| Postgres after a reply | The reply still goes out. Persist is logged, not retried. Chat returns the reply plus a warning. | "The reply was delivered but the conversation record could not be saved." |
| Postgres before a turn | The turn cannot start. | "The conversation record is unavailable. This turn could not start." |
| Blob | Call continues. | "Call audio is not being stored. The conversation continues." |
| Redis (call state / notices) | The call continues. Auth still needs Redis for new requests. | "Call state is running without the cache. The conversation continues." |
