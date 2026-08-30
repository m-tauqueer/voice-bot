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
  - **frontend/** is a copy of `Desktop/component-library` (source only, no `node_modules`). Original library stays on Desktop. UI work happens in `frontend/`. Design notes: `frontend/COMPONENT_LIBRARY.md`.
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
  - `npm run dev:frontend` serves Vite at port **5188**. `/` and `/components` are the gallery; `/dashboard` is the sample shell.
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

**Status: not started.** Tauqueer names one part at a time. Implementation-level plan: [PHASE_2_PLAN.md](PHASE_2_PLAN.md). Do not start a part until he names it.

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
- Manual test: talk over the bot mid-reply; playback stops and the new turn is heard.
- Commit gate: on Tauqueer's word.

### Part 2.6 — Thinking cue & latency capture
- Goal: mask brain latency and measure it.
- Tasks:
  - Short "thinking" cue while the brain works; ensure Engram session opened at call start.
  - Capture per-stage latency spans (STT, brain, reframe, TTS first byte, total).
- Manual test: latency spans recorded per turn; the cue plays without harming barge-in.
- Commit gate: on Tauqueer's word.

### Part 2.7 — Audio persistence to Azure Blob
- Goal: store both sides' audio.
- Tasks:
  - Capture user input + bot TTS audio; upload to Azure Blob; store URLs + metadata in `audio_assets`, linked to turns.
- Manual test: after a call, both user and bot audio are retrievable via stored URLs.
- Commit gate: on Tauqueer's word.

### Part 2.8 — Canonical logging for voice turns
- Goal: full canonical record for voice.
- Tasks:
  - Persist STT finals, controller decisions, Engram ids, latency spans per voice turn; structured turn traces.
- Manual test: a voice conversation produces complete, queryable Postgres records.
- Commit gate: on Tauqueer's word.

### Part 2.9 — End-to-end voice acceptance
- Goal: prove the PRD success criteria live.
- Tasks:
  - Run the full experience; verify memory across turns and across restart, barge-in, audio storage, per-user isolation, latency logging.
- Manual test: the [PRD](PRD.md) §7 checklist passes end-to-end. **Phase 2 done — the product works end to end.**
- Commit gate: on Tauqueer's word.

---

## Phase 3 — Hardening & productionization

Goal: make it robust, observable, and ready to run on Azure; enable deferred capabilities.

### Part 3.1 — Failure handling
- Goal: honest, safe behavior when dependencies fail.
- Tasks:
  - Engram down = product down (clear messaging, no fabricated replies).
  - Deepgram down = session ends + reconnect attempt; handle reframe-LLM and Azure failures.
  - Apply the Engram error taxonomy; never blind-retry writes.
- Manual test: simulate each outage; behavior matches the rules.
- Commit gate: on Tauqueer's word.

### Part 3.2 — Latency tuning
- Goal: hit and hold a per-turn latency budget.
- Tasks:
  - Tune endpointing and the thinking cue; set a p90 turn-latency budget; alert on regressions.
- Manual test: measured p90 meets the agreed budget over a test set of turns.
- Commit gate: on Tauqueer's word.

### Part 3.3 — Observability
- Goal: see what the system is doing per turn.
- Tasks:
  - Structured logs + turn traces; a simple latency/health view; review Engram `insights.logs` for denials/errors.
- Manual test: a conversation is fully reconstructable from traces.
- Commit gate: on Tauqueer's word.

### Part 3.4 — Multilingual (code-switch)
- Goal: enable `language=multi`.
- Tasks:
  - Switch STT config to `multi` with tuned endpointing; verify code-switching; keep it config-driven.
- Manual test: a code-switched utterance is transcribed and answered correctly.
- Commit gate: on Tauqueer's word.

### Part 3.5 — Voice-clone groundwork
- Goal: prepare per-persona / cloned voices.
- Tasks:
  - Per-persona voice config; integration path for a cloned voice (no full clone yet).
- Manual test: switching the configured voice changes the spoken output.
- Commit gate: on Tauqueer's word.

### Part 3.6 — Security & isolation review
- Goal: confirm the safety posture.
- Tasks:
  - Verify per-user isolation end-to-end; secrets never reach the browser; review auth and audit trail.
- Manual test: attempt cross-user access; it is refused and logged.
- Commit gate: on Tauqueer's word.

### Part 3.7 — Azure deployment path
- Goal: run on Azure.
- Tasks:
  - Containerize for Azure (Container Apps/AKS); managed Postgres/Redis; Azure Blob prod; public worker (BYO-LLM) endpoint; CI/CD.
- Manual test: a staging deployment serves a full voice conversation.
- Commit gate: on Tauqueer's word.

### Part 3.8 — Productionization polish
- Goal: final robustness pass.
- Tasks:
  - Rate limits, idempotency for writes, retry policy per Engram guidance, final doc sync.
- Manual test: load/robustness spot checks pass. **Phase 3 done.**
- Commit gate: on Tauqueer's word.
