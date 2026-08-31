# Phase 3 build plan — Hardening, dashboard, and Azure

Detailed, implementation-level plan for Phase 3. Owner: Tauqueer. Read [AGENTS.md](../AGENTS.md), [PRD.md](PRD.md), and [TRD.md](TRD.md) first. This document expands [PHASE_PLAN.md](PHASE_PLAN.md) Phase 3 and supersedes its part numbering — the dashboard was added and the order was changed to match what Tauqueer wants first.

> Phase 3 goal: the product survives its dependencies failing, can be watched and understood from a UI instead of `psql`, is safe to put in front of testers, and runs on Azure instead of a laptop with a tunnel.

**Status: 3.1 complete (`npm run failures` is the accepted gate).** Tauqueer names one part at a time. Do not implement a later part while doing an earlier one.

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
| 3.3 | App shell & navigation | One frame for every screen; `/admin` folds in |
| 3.4 | Owner dashboard — health & latency | The "is it healthy and fast" view |
| 3.5 | Owner dashboard — conversations & people | The "what happened in that call" view |
| 3.6 | Personal view for testers | What a signed-in tester sees |
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
| Persona admin | `/admin`, `frontend/src/app/admin/AdminPage.tsx` | Owner-only: create/edit persona, teach, answer question bank, ingest documents, subscribe testers. **Part 3.3 folds this into the dashboard shell.** |
| Canonical record | Postgres | `users`, `personas`, `subscriptions`, `sessions`, `turns`, `memory_refs`, `audio_assets`, `latency_spans`. See §3. |
| Sample dashboard | `frontend/src/app/dashboard/` | Renders the component library's demo on **mock data** in `frontend/src/app/data.ts`. Parts 3.4–3.6 replace that data; the mock file goes away. |
| Component library | `frontend/src/components/` | Primitives **and** viz already copied — see §4. Nothing needs importing from `Desktop/component-library` again; that stays the reference, not a dependency. |
| Probes | `package.json` | `smoke`, `controller`, `reframe`, `chat`, `byo`, `brains`, `voice`, `call`, `audio`, `bargein`, `isolation`. |

---

## 2. Locked decisions (Phase 3)

Settled with Tauqueer before this plan was written. Do not silently change them.

- **D13 — The dashboard is role-split, one route.** `/dashboard` renders the **owner ops view** for an email in `OWNER_EMAILS` and the **personal view** for every other signed-in user. Role comes from the server (`/api/me` already returns `owner`), never from a client guess.
- **D14 — The dashboard absorbs admin.** One owner surface with tabs (Overview, Conversations, People, Persona). The current `/admin` becomes the Persona tab; the `/admin` route redirects into the dashboard so existing links keep working.
- **D15 — The app shell is the library's.** `AppShell` + `Sidebar` + `TopBar` wrap dashboard, chat, voice and the persona tab. Navigation items are role-filtered.
- **D16 — The dashboard is read-only about conversations.** It shows the canonical record; it never edits turns, and it never reaches Engram to answer a question on a user's behalf. Persona teaching stays in its own tab and keeps its existing write paths.
- **D17 — Azure shape is Container Apps.** Three container apps (gateway, worker, frontend), Azure Database for PostgreSQL, Azure Cache for Redis, Azure Blob for audio. The worker gets a real public URL, which retires the ngrok dependency in `BYO_LLM_PUBLIC_URL`.
- **D18 — Blob audio switches on at deployment.** `VOICE_AUDIO_PERSIST_ENABLED` stays `false` until part 3.9 provisions a storage account. The capture, WAV and turn-binding code is already built and tested against the emulator.
- **D19 — No new brains.** Phase 3 does not add another Engram path. `BRAIN_MODE` stays as it is; the dashboard reports on both.

---

## 3. The canonical record the dashboard reads

Everything below already exists and is populated. No migration is needed for parts 3.2–3.6 unless a part says so.

```
users(id, google_sub, email, engram_user_id, created_at, updated_at)
personas(id, engram_persona_id, handle, display_name, description, voice_config, ...)
subscriptions(id, user_id, persona_id, status, created_at)
sessions(id, user_id, persona_id, engram_session_id, channel, started_at, ended_at)
turns(id, session_id, ordinal, speaker, text, messages, controller_action,
      controller_reasons, stt_meta, tts_meta, brain_mode, created_at)
memory_refs(id, turn_id, memories_used, engram_session_id, created_at)
audio_assets(id, turn_id, direction, blob_url, duration_ms, format, size_bytes, created_at)
latency_spans(id, turn_id, stt_ms, brain_ms, reframe_ms, reframe_first_token_ms,
              tts_first_byte_ms, total_ms, transport_latency, created_at)
```

Notes that matter when querying:

- `channel` is `text` or `voice`; both live in the same tables.
- `brain_mode` is `retrieve`, `chat`, or NULL for turns recorded before it existed. Any A/B view must handle NULL.
- `latency_spans` attaches to the **persona** turn when the turn spoke, and to the user turn when it stayed silent.
- `reframe_first_token_ms` is when speech could start — the number to show as "time to first word", not `total_ms`.
- `transport_latency` is JSONB holding the transport's own breakdown (`ttt_text_latency`, `tts_latency`, `total_latency`, sometimes `stt_latency`).
- `audio_assets` is empty until 3.9. Every view must render cleanly with no audio.
- **Isolation is on `sessions.user_id`.** Every non-owner query joins through `sessions` and filters on it. There is no other gate — Engram is not refusing anyone (see §7).

---

## 4. Component inventory (already copied, ready to use)

Reference: `Desktop/component-library`. Do not re-copy; use what is in `frontend/src`.

**Primitives** (`frontend/src/components/ui/`): `Badge`, `Button`, `Card`, `Chip`, `ClipButton`, `Input`, `Meter` (incl. `BarMeter`), `Segmented`, `Switch`.

**Visualisation** (`frontend/src/components/viz/`): `ActivityCalendar`, `ActivityGraph`, `MemoryComposition`, `NodeRing`, `NodeSparkline`, `RecallHeatmap`.

**Shell** (`frontend/src/app/shell/`): `AppShell`, `Sidebar`, `TopBar`.

**Dashboard pieces** (`frontend/src/app/dashboard/`): `DashboardPage`, `KpiStrip`, `Section`, `MemoryActivity`, `RecentActivity`, `FeaturedMemory`, `ConnectorList`, `QuickActions`, `QuickCapture`, `Composer`.

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

**Manual test.** `npm run failures` — taxonomy, reconnect rules, Redis timeout, and the worker turn runner against a real session. Live outages (dead Engram host, dropped tunnel, Redis stopped mid-call) are optional; the probe is the accepted gate.

**Done when.** `npm run failures` passes and each row in §7 is implemented in code.

---

## Part 3.2 — Read API for the canonical record

**Goal.** The gateway can serve everything the dashboard needs, correctly scoped, without the browser ever touching Postgres shapes it should not see.

**Files.**
- `gateway/src/routes/insights.ts` (new) — the read endpoints.
- `gateway/src/insights/queries.ts` (new) — the SQL, one function per view.
- `gateway/src/insights/types.ts` (new) — response shapes shared with the frontend.
- Register in `gateway/src/index.ts`.

**Logic.** Two families, two guards.

*Personal (any signed-in user, `requireAppUser`):*
- `GET /api/me/overview` — counts and last activity for **this user**.
- `GET /api/me/sessions?range=&cursor=` — their calls and chats, newest first.
- `GET /api/me/sessions/:id` — one session: ordered turns, per-turn timings, audio when present. 404 if it is not theirs. Never 403 with detail — do not confirm another user's session exists.

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

**Manual test.** Extend `npm run isolation`: a non-owner gets 403 on every `/api/admin/*` endpoint, sees only their own sessions on `/api/me/*`, and gets 404 for another user's session id. Numbers from `/api/admin/overview` match the same query run in `psql`.

**Done when.** Every number the dashboard will show can be fetched from an endpoint, and the isolation probe covers the admin surface.

---

## Part 3.3 — App shell & navigation

**Goal.** One navigation frame around every screen, with `/admin` folded in.

**Files.**
- `frontend/src/app/shell/AppShell.tsx`, `Sidebar.tsx`, `TopBar.tsx` — already copied; wire them to real routes and identity.
- `frontend/src/Root.tsx` — render pages inside the shell.
- `frontend/src/lib/routes.ts` — add dashboard tab routes; keep `/admin` as a redirect.
- `frontend/src/app/admin/AdminPage.tsx` — becomes the Persona tab's body, unchanged in behaviour.

**Logic.**
- Nav items come from one config-driven list, filtered by role. A non-owner never sees an owner item — and the server refuses it anyway (3.2), so the UI filter is convenience, not security.
- `/admin` redirects to the Persona tab. Do not break the existing link.
- Sign-in state, persona name and account live in `TopBar`.
- No new CSS files. `app-shell.css` and `dashboard.css` are already imported.

**Config.** Route constants; nav labels. Nothing hardcoded in more than one place.

**Errors.** Signed-out users get the existing sign-in card, not a broken shell.

**Manual test.** Sign in as owner: sidebar shows Overview, Conversations, People, Persona, Chat, Voice. Sign in as a tester: only the personal items. `/admin` lands on the Persona tab and everything there still works.

**Done when.** Every screen renders inside the shell and `/admin` no longer exists as a standalone page.

---

## Part 3.4 — Owner dashboard: health & latency

**Goal.** Answer "is it healthy, and is it fast" without opening `psql`.

**Files.**
- `frontend/src/app/dashboard/DashboardPage.tsx` — becomes the role-split entry (D13).
- `frontend/src/app/dashboard/owner/OverviewTab.tsx` (new).
- `frontend/src/lib/insights.ts` (new) — typed fetch helpers for 3.2.
- Delete the mock `frontend/src/app/data.ts` once nothing imports it.

**Logic.**
- `KpiStrip`: calls, turns, **median time to first word** (`reframe_first_token_ms` + `brain_ms`), error rate.
- `Segmented` range switch driving every panel from one piece of state.
- `ActivityGraph` for turns over the range; `RecallHeatmap` for activity or latency by hour.
- Latency panel: p50/p90 per stage (STT, brain, first token, TTS), **split by `brain_mode`** so the A/B stays visible. Handle NULL `brain_mode` as "unrecorded".
- `BarMeter` showing p50 against `LATENCY_BUDGET_FIRST_WORD_MS`.
- Empty range renders an honest empty state, never a zero that looks like data.

**Config.** `VITE_INSIGHTS_DEFAULT_RANGE`, `VITE_LATENCY_BUDGET_FIRST_WORD_MS` (mirror of the gateway value for the meter).

**Errors.** A failed fetch shows an error card and a retry, not an empty dashboard that reads as "no activity".

**Manual test.** Hold two calls, one in each `BRAIN_MODE`. The overview shows both, the latency split matches `npm run brains`, and the KPI numbers match `psql`.

**Done when.** The numbers are right, the range switch works, and no mock data remains.

---

## Part 3.5 — Owner dashboard: conversations & people

**Goal.** Find any conversation and read exactly what happened in it.

**Files.**
- `frontend/src/app/dashboard/owner/ConversationsTab.tsx` (new)
- `frontend/src/app/dashboard/owner/SessionDetail.tsx` (new)
- `frontend/src/app/dashboard/owner/PeopleTab.tsx` (new)
- `frontend/src/app/dashboard/owner/PersonaTab.tsx` — hosts the existing admin screen.

**Logic.**
- Conversations list: user, channel badge (`text`/`voice`), start, duration, turn count, whether it ended, brain mode. Filters by range, channel and user. Cursor paging.
- Session detail: turns in order with speaker, text, controller action and reasons, per-turn timings, `stt_meta` transcript and `tts_meta` voice, memory refs, and audio players when `audio_assets` has rows (nothing until 3.9 — render the absence honestly).
- People: users with call counts, last seen, and their subscription state. Note in the UI that subscription is **not** an access gate today (§7) so nobody reads it as one.
- Persona tab: the current admin screen, behaviour unchanged.

**Config.** Page sizes and filter options from 3.2's config. Channel and action labels from the existing schema constants, not new strings.

**Errors.** A session that vanishes mid-view shows a clear message. Long transcripts virtualise or page rather than freezing.

**Manual test.** Pick a call from a live test, open it, and confirm the transcript matches what was actually said, the timings match `latency_spans`, and the controller reasons are shown.

**Done when.** A call can be reconstructed in the UI as completely as the SQL reconstruction in Phase 2 §9.

---

## Part 3.6 — Personal view for testers

**Goal.** A signed-in tester sees their own history and what the persona knows about them.

**Files.**
- `frontend/src/app/dashboard/personal/PersonalDashboard.tsx` (new)
- Reuses `SessionDetail` from 3.5 against the `/api/me/*` endpoints.

**Logic.**
- Their calls and chats, newest first, with a way back into `/chat` or `/voice`.
- One session's transcript, same component as the owner view, different endpoint.
- "What it remembers about you": read the caller's **own** private pool via the existing Engram wrapper (`personas.retrieve` scoped to their `engram_user_id`) or from `memory_refs` on their turns. Never another user's pool, never a hand-built tenant (TRD §3).
- No system metrics, no other users, no owner data.

**Config.** How many memories to show; whether the memory panel is enabled at all.

**Errors.** Engram unavailable degrades the memory panel only — the history still renders.

**Manual test.** Two accounts, side by side: each sees only their own calls, and neither can reach the other's session id by editing the URL.

**Done when.** A tester has something genuinely useful and provably cannot see anyone else.

---

## Part 3.7 — Observability & latency budgets

**Goal.** A turn can be traced end to end, and a latency regression is noticed without someone looking.

**Files.**
- `gateway/src/routes/voice.ts`, `worker/src/worker/turn/service.py` — a correlation id carried across gateway → worker → record.
- `worker/src/worker/api/chat_completions.py` — already logs per turn; add the correlation id.
- A budget check (a probe or a scheduled query) comparing recent p50/p90 against config.

**Logic.**
- One id per turn, present in gateway logs, worker logs and the stored row, so a log line and a database row can be joined.
- Structured logs everywhere, no secrets, no transcript text in logs beyond what already exists.
- Budgets: p50 and p90 for time to first word, per `brain_mode`. Breaching writes a loud log and fails the check.
- Review Engram `insights.logs` for denials and errors (TRD §3).

**Config.** `LATENCY_BUDGET_FIRST_WORD_MS`, `LATENCY_BUDGET_P90_MS`, `LATENCY_BUDGET_WINDOW`, and the log field allow-list.

**Errors.** The budget check reports; it never changes behaviour on its own.

**Manual test.** Run a handful of turns, then run the budget check and see it pass; force it to fail by lowering the budget and confirm it says so clearly.

**Done when.** A single turn is traceable from log to row, and a regression is detectable by running one command.

---

## Part 3.8 — Security & isolation review

**Goal.** Confirm the safety posture before anyone outside the team uses it.

**Files.** Mostly review; fixes land where the review finds them.

**Logic.** Check, and write down the result of each:
1. Per-user isolation end to end — repeat `npm run isolation`, plus the admin surface from 3.2, plus URL tampering in the UI from 3.6.
2. **The Engram subscription finding** (§7): access is not gated by subscription today, and the API key cannot subscribe (`org:manage` missing). Decide whether to pursue the permission, enforce subscription in the app, or accept it and record why.
3. Secrets never reach the browser — only `VITE_*` is exposed; audit for accidental leakage into logs or client payloads.
4. Session cookie flags in production (`SESSION_COOKIE_SECURE`, `SameSite`), CORS origins, and the internal secret between gateway and worker.
5. The BYO-LLM endpoint is publicly reachable by design — confirm it refuses everything without the internal secret and cannot be driven with forged identity headers (already covered by two probe cases; re-verify against the deployed URL).
6. Audit trail: every turn attributable to a user and a session.

**Config.** Production cookie and CORS settings.

**Errors.** Any finding is either fixed in this part or written into the TRD as accepted, with the reason.

**Manual test.** Attempt cross-user access from a second real account and from a crafted request; both refused and logged.

**Done when.** Every item above has a recorded answer, and nothing outstanding is unwritten.

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
- The worker gets a public URL; `BYO_LLM_PUBLIC_URL` points at it and ngrok is retired.
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

1. **A second Google account sign-in** has still not been done. Everything after Google's redirect is proven; the OAuth flow for a genuinely new account is not. Fold into 3.8.
2. **Blob audio archiving is off** (`VOICE_AUDIO_PERSIST_ENABLED=false`) until 3.9 provisions storage.
3. **The Engram API key lacks `org:manage`**, so `personas.subscribe` returns 403 and the `subscriptions` mirror stays empty. Decide in 3.8.
4. **Engram does not gate access on subscription** — an unknown user id was allowed `chat`, `retrieve` and `converse`. Isolation rests on the app's session-ownership check. Confirm and record in 3.8.
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
