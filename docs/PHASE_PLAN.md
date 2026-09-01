# Phase Plan — Voice Persona Bot

The build plan. Owner: Tauqueer. Read [AGENTS.md](../AGENTS.md), [PRD](PRD.md), and [TRD](TRD.md) before starting any part.

## How to use this document

- **Tauqueer names a phase and a part.** Do only that part.
- Complete every task in the part to production quality (see principles in [AGENTS.md](../AGENTS.md) §7).
- Where a part has a **Manual test**, it must pass before the part is considered done.
- **Commit gate:** commit only when Tauqueer explicitly says so, after the part is complete and its manual test passes. Commit style: normal, plain, no AI attribution. Do not mention phase numbers or part numbers in the commit message — describe the work in plain language. Those labels stay in this plan only.
- Do not start the next part until told.

**Structure:** Phase 0 is setup. Phases 1-3 are the product, each split into parts. Each part is a self-contained unit of work.

---

## Phase 0 — Setup (repo and toolchain ready to build) — ✅ COMPLETE

Goal: after Phase 0, anyone can clone, install, and run empty scaffolding for all three services locally, with every external dependency reachable. No product behavior yet.

**Status: complete.** All parts 0.1–0.6 are implemented and their manual tests pass. `npm run infra:up && npm run smoke` reports `OK` for postgres, redis, migrations, and Google; optional vendors `SKIP` until those keys are set. Phase 1 record: [PHASE_1_PLAN.md](PHASE_1_PLAN.md). Phase 2 build plan: [PHASE_2_PLAN.md](PHASE_2_PLAN.md).

### Part 0.1 — Repo layout & conventions
- Goal: initialize the repository and its skeleton.
- Tasks:
  - `git init`; add `.gitignore`, `.editorconfig`.
  - Create top-level structure: `frontend/`, `gateway/`, `worker/`, `infra/`, `docs/` (docs already exist).
  - Add a short root pointer to `AGENTS.md` (no bloated README).
  - Decide and record the monorepo tool/workspace layout in this section.
- Locked layout:
  - **npm workspaces** at the repo root (`package.json` `workspaces`: `frontend`, `gateway`). One root lockfile after Part 0.2. Worker is Python and is **not** in the JS workspace.
  - **frontend/** is the product UI. `Desktop/component-library` stays on Desktop as the reference; copy a primitive into `frontend/` only when the product uses it. Do not keep the gallery in this repo. Design notes: `frontend/COMPONENT_LIBRARY.md`.
  - **gateway/** is a TypeScript workspace package (`gateway/package.json`). Dependencies in Part 0.2.
  - **worker/** is a **uv** project (`worker/pyproject.toml`, `requires-python >= 3.12`, src layout `worker/src/worker/`). Dependencies in Part 0.2.
  - **infra/** holds Docker Compose, migrations, and scripts (Part 0.4).
  - **EditorConfig:** UTF-8, LF, trim trailing whitespace, final newline; indent 2 for TS/JS/CSS/JSON/HTML; indent 4 for Python; Makefile tabs.
- Manual test: none.
- Commit gate: on Tauqueer's word.

### Part 0.2 — Toolchains & dependency baseline
- Goal: install and pin dependencies for all three services.
- Tasks:
  - Gateway (TypeScript/Node): init project, TS config, lint/format, WebSocket + HTTP framework, Redis/Postgres/Azure-Blob/OAuth client libs.
  - Worker (Python): init project + virtual env, lint/format, install `engram-ai-sdk`, reframe LLM SDK, web framework for the BYO-LLM endpoint, Postgres client.
  - Frontend: bring in the existing component library as the base (workspace package or copy), install deps.
  - Pin versions; record install/run commands in `AGENTS.md` §6.
- Locked toolchain:
  - Node 22, Python 3.12, npm workspaces + uv.
  - Gateway: Fastify + `@fastify/websocket` + `@fastify/cors`, postgres.js, ioredis, `@azure/storage-blob`, pino, dotenv, Zod, tsx, TypeScript. No OAuth library (Google Sign-In fetch util in Part 1.3).
  - Worker: FastAPI + uvicorn, `engram-ai-sdk`, OpenAI SDK, `psycopg[binary]`, pydantic-settings, structlog, Ruff.
  - Lint: Biome (gateway now; copied `frontend/src` is excluded so we do not rewrite the library). Worker: Ruff.
- Manual test: none (build/typecheck each service compiles).
- Commit gate: on Tauqueer's word.

### Part 0.3 — Environment & configuration
- Goal: config-driven everything; no hardcoded values.
- Tasks:
  - `.env.example` enumerating every key: Deepgram, Engram (org/key), OpenAI (or the configured reframe LLM), Azure Blob, Google OAuth, Postgres, Redis, dev-tunnel.
  - Config loader modules per service that fail fast on missing values.
- Locked config:
  - One root `.env` + `.env.example`. Frontend reads the same file via Vite `envDir: ".."`. Only `VITE_*` is public.
  - Azure: `AZURE_STORAGE_ACCOUNT` + `AZURE_STORAGE_KEY` + `AZURE_BLOB_CONTAINER`.
  - Gateway: Zod (`gateway/src/config.ts`). Worker: pydantic-settings (`worker/src/worker/config.py`). Process exits on invalid/missing **required** keys. Google Sign-In is required to boot the gateway. Azure, Deepgram, Engram, OpenAI, and `BYO_LLM_PUBLIC_URL` are optional until those parts; using those clients without keys fails with a clear error. Extra keys ignored on the worker.
- Manual test: none.
- Commit gate: on Tauqueer's word.

### Part 0.4 — Docker Compose & local services
- Goal: one command brings up local infra.
- Tasks:
  - Compose file: Postgres + Redis (+ dev containers for gateway/worker/frontend as chosen).
  - Health checks; helper scripts (`make`/npm scripts) to start/stop/reset.
- Locked for this part:
  - **Postgres 16 + Redis 7 only.** Gateway, worker, and frontend stay on the host (`DATABASE_URL` / `REDIS_URL` use `localhost`). App images are Phase 3.
  - Compose file: [`infra/compose.yaml`](../infra/compose.yaml). Credentials and ports come from the repo-root `.env` (`POSTGRES_*`, `REDIS_PORT`).
  - Scripts: `npm run infra:up|down|reset|ps` and matching `make infra-*` targets. `up` uses `--wait` so it returns after healthchecks pass.
- Manual test: `compose up` brings Postgres and Redis to healthy; services start.
- Commit gate: on Tauqueer's word.

### Part 0.5 — Frontend base runs
- Goal: the component-library frontend renders locally.
- Tasks:
  - Wire the frontend entry, confirm design tokens/styles load in correct order (see the component library README notes).
  - Confirm dev server runs and a base page renders.
- Locked / verified:
  - CSS is imported only from [`frontend/src/main.tsx`](../frontend/src/main.tsx), in the documented order (`oc.tailwind.css` → `oc.css` → `fonts.css` → `index.css` → `surfaces.css` → `dial.css` → `ui.css` → `app-shell.css` → `dashboard.css`). No component imports CSS.
  - `npm run dev:frontend` serves Vite at port **5188**. `/` is the landing page; `/dashboard` is the signed-in personal app; `/admin` is owner-only. Vite proxies `/auth`, `/api`, and `/ws` to the gateway bind port.
- Manual test: open the local frontend; base UI renders with correct styling.
- Commit gate: on Tauqueer's word.

### Part 0.6 — External-account smoke checks
- Goal: prove every external dependency is reachable with the provided credentials.
- Tasks:
  - Scripts that: reach Engram (account/config), validate Deepgram key, list OpenAI models (or reframe LLM), create/list an Azure Blob container, confirm the Google OAuth app config, run an empty DB migration.
- Locked / verified:
  - Smoke entry: `npm run smoke` (or `make smoke`) → `gateway/src/smoke.ts`. Prints `OK` / `SKIP` / `FAIL` per check; secrets are never logged. Exit code 1 if any check is `FAIL`.
  - Required (must be `OK`): Postgres, Redis, empty baseline migration (`infra/migrations/0001_baseline.sql` is `SELECT 1;` only; product tables are Part 1.1), Google (OIDC discovery + dummy token exchange expecting structured `invalid_grant`, not `invalid_client`).
  - Optional until later parts: Azure, Deepgram, OpenAI, Engram. Unset keys report `SKIP` (not a failure). If a key is set, the matching base URL must be set and the live call must succeed.
  - Google OIDC discovery URL: `GOOGLE_OIDC_DISCOVERY_URL` (required to boot the gateway).
- Manual test: `npm run infra:up` then `npm run smoke`; required checks OK; optional checks SKIP or OK. **Phase 0 done.**
- Commit gate: on Tauqueer's word.

---

## Phase 1 — Brain first (text, no voice) — ✅ COMPLETE

Goal: a signed-in user holds a **typed** conversation with the persona, grounded in Engram memory, with the canonical record persisted. Proves the brain before adding real-time voice.

**Status: complete.** Parts 1.1–1.8 shipped. A signed-in user talks at `/chat`; the worker runs controller → Engram `personas.chat` → reframe; turns and an Engram `session_id` persist in Postgres; memory survives a worker restart. Isolation is enforced on the session row (`sessions.user_id`). Implementation record: [PHASE_1_PLAN.md](PHASE_1_PLAN.md).

### Part 1.1 — Postgres schema & migrations
- Goal: the canonical data model exists.
- Tasks:
  - Implement tables from [TRD](TRD.md) §5 (`users`, `personas`, `subscriptions`, `sessions`, `turns`, `memory_refs`, `audio_assets`, `latency_spans`).
  - Forward-only SQL runner in the gateway (`npm run migrate`); one `schema_migrations` ledger; smoke uses that runner. Seed nothing hardcoded.
- Manual test: migrations apply cleanly to an empty DB; re-running is a no-op.
- Commit gate: on Tauqueer's word.

### Part 1.2 — Engram client wrapper (behind an interface)
- Goal: all Engram access goes through one swappable interface.
- Tasks:
  - Wrapper exposing: create/teach/answer/question-bank, document ingest to shared, subscribe, `chat(session_id)`, `retrieve`, `conversations`.
  - Enforce contracts from [TRD](TRD.md) §3 (no hand-built tenants; carry `session_id`; read `tenant` per row; generous timeout; error taxonomy).
- Manual test: a script creates a throwaway persona, teaches one fact, chats, and gets a grounded reply.
- Commit gate: on Tauqueer's word.

### Part 1.3 — Auth (Google OAuth) & user mapping
- Goal: users sign in and map to an Engram `user_id`.
- Tasks:
  - Google OAuth/OIDC in the gateway; session cookie/JWT.
  - Map Google subject -> app user -> Engram `user_id`; persist in `users`.
  - Enforce per-user isolation on every request.
- Manual test: two different Google accounts sign in and receive distinct app users / Engram user ids.
- Commit gate: on Tauqueer's word.

### Part 1.4 — Persona admin (minimal screen)
- Goal: the owner can create and teach the single persona.
- Tasks:
  - Minimal admin screen (on component-library) to: create/edit persona (name, handle, description, voice config), teach facts, answer the question bank, upload/ingest documents to the shared pool, subscribe test users.
- Manual test: owner creates the persona, teaches a few facts + one document, subscribes a tester.
- Commit gate: on Tauqueer's word.

### Part 1.5 — Reframe module
- Goal: turn an Engram reply into natural, spoken, fact-locked output.
- Tasks:
  - Config-pluggable LLM (default `gpt-4o-mini`).
  - Prompt = Engram reply + last N turns + persona voice rules; paraphrase/fact-lock (no invented facts, minor connective phrasing only).
  - No keyword logic; behavior is model-driven.
- Manual test: given a canned Engram reply, the reframe produces a natural spoken version that adds no new facts.
- Commit gate: on Tauqueer's word.

### Part 1.6 — Controller (speak/silence gate)
- Goal: decide whether to speak, from the `chat` result and structured signals.
- Tasks:
  - Controller producing a structured decision (action + reason codes + optional hints).
  - Strictly no keyword/intent matching (see [AGENTS.md](../AGENTS.md) §7).
- Manual test: feed representative `chat` results; the controller returns sensible speak/silence decisions with reasons.
- Commit gate: on Tauqueer's word.

### Part 1.7 — Text chat loop end-to-end
- Goal: wire user text -> controller -> `chat` -> reframe -> reply, with persistence.
- Tasks:
  - Gateway endpoint for a typed turn; worker runs the brain; one Engram `session_id` per session.
  - Persist turns, controller decisions, Engram ids, latency spans to Postgres; ephemeral state in Redis.
- Manual test: a multi-turn typed conversation where the persona recalls earlier turns in the same session.
- Commit gate: on Tauqueer's word.

### Part 1.8 — Chat UI + memory-across-restart proof
- Goal: a usable typed chat UI proving persistent memory.
- Tasks:
  - Chat interface on component-library: persona header, transcript, session continuity.
  - Resume behavior using stored Engram `session_id`.
- Manual test: hold a conversation, restart the worker/process, resume, and confirm the persona still remembers. **Phase 1 done.**
- Commit gate: on Tauqueer's word.

---

## Phase 2 — Voice loop (Deepgram Voice Agent API)

Goal: the end-to-end spoken product — talk in the browser, hear the persona, interrupt it, with audio persisted. English only.

**Status: 2.1–2.9 built; every PRD §7 criterion demonstrated end to end.** Latency work was folded in on Tauqueer's instruction. Implementation record, measured numbers, the acceptance evidence, and what still needs Tauqueer personally: [PHASE_2_PLAN.md](PHASE_2_PLAN.md) §7–§9.

### Part 2.1 — BYO-LLM shim endpoint
- Goal: expose the worker brain as the LLM Deepgram calls.
- Tasks:
  - OpenAI-compatible endpoint that maps the Deepgram session/user -> Engram `session_id` + `user_id` and runs controller -> `chat` -> reframe, returning the reframed reply.
  - Make it reachable by Deepgram (dev tunnel locally; document it).
- Manual test: a simulated BYO-LLM request returns a correct reframed reply for a known user/persona.
- Commit gate: on Tauqueer's word.

### Part 2.2 — Gateway ↔ Deepgram Voice Agent bridge
- Goal: establish and manage the Voice Agent session.
- Tasks:
  - Open WSS; handle `Welcome`; send `Settings` (audio format, Nova-3 `en`, Aura-2 voice, BYO-LLM config); wait `SettingsApplied`.
  - Relay client audio up and agent audio down; handle `Error`/`Warning`.
  - Open the Engram `session_id` at call start.
- Manual test: a session reaches `SettingsApplied` and round-trips a scripted audio clip to spoken output.
- Commit gate: on Tauqueer's word.

### Part 2.3 — Browser audio capture & playback
- Goal: mic in, audio out, in the browser.
- Tasks:
  - Mic capture (WebRTC/MediaRecorder) streamed to the gateway; playback of agent audio; device-permission handling.
- Manual test: speak into the mic and hear the persona reply end-to-end.
- Commit gate: on Tauqueer's word.

### Part 2.4 — Voice UI components
- Goal: the voice experience UI on the design tokens.
- Tasks:
  - Mic button + states, live transcript (interim/final), waveform/VU meter, persona listening/thinking/speaking states.
- Manual test: UI reflects real states during a live conversation.
- Commit gate: on Tauqueer's word.

### Part 2.5 — Barge-in
- Goal: the user can interrupt the bot.
- Tasks:
  - Handle `UserStartedSpeaking`: stop playback + flush buffered audio immediately.
- Manual test: talk over the bot mid-reply; playback stops and the new turn is heard. **Confirmed live in a quiet room.** A synthetic-speech probe (`npm run bargein`, `npm run call`) covers the state machine, including the case where an interrupted utterance never reports its end.
- Commit gate: on Tauqueer's word.

### Part 2.6 — Thinking cue & latency capture
- Goal: mask brain latency and measure it. **Latency reduction was folded in here on Tauqueer's instruction** — see [PHASE_2_PLAN.md](PHASE_2_PLAN.md) §7.
- Tasks:
  - Short "thinking" cue while the brain works; ensure Engram session opened at call start.
  - Capture per-stage latency spans (STT, brain, reframe, TTS first byte, total).
- Manual test: latency spans recorded per turn; the cue plays without harming barge-in. **Done.** The cue had never played at all — it hung off an event the transport does not emit.
- Commit gate: on Tauqueer's word.

### Part 2.7 — Audio persistence to Azure Blob
- Goal: store both sides' audio.
- Tasks:
  - Capture user input + bot TTS audio; upload to Azure Blob; store URLs + metadata in `audio_assets`, linked to turns.
- Manual test: after a call, both user and bot audio are retrievable via stored URLs. **Built and verified against the storage emulator**; switched off (`VOICE_AUDIO_PERSIST_ENABLED=false`) until there is a real storage account.
- Commit gate: on Tauqueer's word.

### Part 2.8 — Canonical logging for voice turns
- Goal: full canonical record for voice.
- Tasks:
  - Persist STT finals, controller decisions, Engram ids, latency spans per voice turn; structured turn traces.
- Manual test: a voice conversation produces complete, queryable Postgres records. **Done** — a call reconstructs from SQL alone, including transcript, controller reasons, memory refs, per-stage timings and which brain answered.
- Commit gate: on Tauqueer's word.

### Part 2.9 — End-to-end voice acceptance
- Goal: prove the PRD success criteria live.
- Tasks:
  - Run the full experience; verify memory across turns and across restart, barge-in, audio storage, per-user isolation, latency logging.
- Manual test: the [PRD](PRD.md) §7 checklist passes end-to-end. **Phase 2 done — the product works end to end.** Criteria 1–3 and 6 confirmed by Tauqueer live plus probes; 4 verified against the storage emulator; 5 verified over real HTTP with two accounts, with a second Google sign-in the one outstanding click.
- Commit gate: on Tauqueer's word.

---

## Phase 3 — Hardening, dashboard & productionization

Goal: survive dependency failures, be watchable from a UI instead of `psql`, be safe in front of testers, and run on Azure instead of a laptop with a tunnel.

**Status: 3.1–3.6 implemented.** Remaining parts start when Tauqueer names one. Implementation-level plan: [PHASE_3_PLAN.md](PHASE_3_PLAN.md).

The parts below were **renumbered from the original Phase 3 list** after Tauqueer set priorities (failure handling and observability first, then security, then Azure) and added the dashboard. Multilingual and voice cloning moved to the end.

### Part 3.1 — Failure handling
- Goal: honest, safe behaviour when any dependency fails.
- Tasks: Engram down = product down; Deepgram down = session ends + one reconnect; speaking-LLM, Postgres, Redis and Blob failures each behave as [TRD](TRD.md) §7 says. Never blind-retry writes, never fabricate a reply.
- Manual test: `npm run failures`. **Done.**

### Part 3.2 — Read API for the canonical record
- Goal: serve everything the dashboard needs, correctly scoped.
- Tasks: personal endpoints (`/api/me/*`) scoped to `sessions.user_id`; owner endpoints (`/api/admin/*`) behind the owner guard; percentiles in SQL; cursor paging.
- Manual test: `npm run isolation` covers the admin surface; overview numbers match the SQL. **Done.**

### Part 3.3 — App shell & navigation
- Goal: two navigation frames — personal app and `/admin`.
- Tasks: library `AppShell`; same Home/Chat/Voice for every user; owner-only Admin sidebar item; `/admin` is its own app.
- Manual test: `npm run nav`; owner and tester see the same personal nav in the browser; only the owner reaches `/admin`; persona forms still work.

### Part 3.4 — Admin overview: health & latency
- Goal: answer "is it healthy and fast" without SQL.
- Tasks: KPIs, activity over a range, per-stage p50/p90 split by brain mode, p50 against the configured budget.
- Manual test: numbers match `psql` and `npm run brains`.

### Part 3.5 — Admin conversations & people
- Goal: find any conversation and read what happened in it.
- Tasks: filterable session list; full transcript with controller reasons, timings, memory refs and audio when present; users with activity.
- Manual test: a call reconstructs in the UI as completely as it does in SQL.

### Part 3.6 — Personal home
- Goal: a signed-in user sees their own history and what the persona remembers about them.
- Tasks: their calls and spoken transcripts; their own retrieve only; no system metrics.
- Manual test: two accounts side by side, neither can reach the other by editing a URL.

### Part 3.7 — Observability & latency budgets
- Goal: trace a turn end to end and notice a regression without watching.
- Tasks: one correlation id across gateway, worker and the stored row; structured logs; p50/p90 budgets per brain mode; review Engram `insights.logs`.
- Manual test: a turn is traceable from log line to database row; the budget check passes, then fails when tightened.

### Part 3.8 — Security & isolation review
- Goal: confirm the safety posture before outside testers.
- Tasks: isolation end to end including the admin surface and URL tampering; decide what to do about Engram not gating on subscription; cookie, CORS and secret audit; verify the public BYO-LLM endpoint refuses forged identity.
- Manual test: cross-user access attempted from a second real Google account and a crafted request; both refused and logged.

### Part 3.9 — Azure deployment
- Goal: off the laptop, tunnel retired, audio stored.
- Tasks: Container Apps for gateway, worker and frontend; managed Postgres and Redis; Blob provisioned and audio archiving switched on; migrations as a deploy step; CI/CD.
- Manual test: staging serves a full voice conversation with audio in Blob; `npm run smoke` reports Azure `OK`.

### Part 3.10 — Multilingual (code-switch)
- Goal: `language=multi`, config-driven.
- Manual test: a code-switched utterance is transcribed and answered correctly.

### Part 3.11 — Voice-clone groundwork
- Goal: voice becomes a property of the persona, with a documented clone seam.
- Manual test: changing a persona's configured voice changes the spoken output.

### Part 3.12 — Productionization polish
- Goal: final robustness pass.
- Tasks: rate limits, write idempotency, retry policy, dependency pinning, documentation sync.
- Manual test: load and robustness spot checks pass. **Phase 3 done.**
