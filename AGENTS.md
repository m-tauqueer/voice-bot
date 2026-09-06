# AGENTS.md — Read this first, every time

This is the entry point for any agent (human or AI) working in this repository. Read this file in full before touching anything. It tells you what the project is, which documents govern it, how to start, and the non-negotiable working rules.

If a rule here conflicts with a general instinct you have, this file wins.

---

## 1. What this project is

A voice bot you can talk to that speaks as a **persona** with real long-term memory. Speech is handled by Deepgram, the persona brain and memory are handled by Engram, and a small reframing LLM turns the persona's recalled answer into natural spoken output.

The one-line data flow for the shipping architecture:

```
browser mic -> Deepgram Voice Agent API (STT + TTS + turn-taking + barge-in)
            -> BYO-LLM shim (controller -> Engram memory -> speaking LLM, streamed)
            -> Deepgram speaks the reply as the words are produced
```

Full detail is in the docs below. Do not infer architecture from this summary — read the TRD.

---

## 2. Owner and control

- **Owner: Tauqueer.** He directs all work.
- **Tauqueer decides which phase and which part to start.** Never pick the next part yourself. Never jump ahead, and never work more than one part at a time unless he says so.
- If a part is ambiguous or you hit a real decision point, **stop and ask Tauqueer** rather than guessing.

---

## 3. Working loop (follow exactly)

1. Tauqueer names a **phase** and a **part** from [`docs/PHASE_PLAN.md`](docs/PHASE_PLAN.md).
2. Complete **only that part** — all of its tasks, nothing from later parts.
3. Where the part has a **Manual test**, run it (or walk Tauqueer through running it) and confirm it passes. Do not mark a part done until its manual test passes.
4. **Do not commit automatically.** Commits happen **only when Tauqueer explicitly says to commit**, and **only after the part is complete** and its manual test has passed.
5. After a commit (or if no commit is requested), stop and wait for the next instruction.

---

## 4. Commit rules

- Commit **only on Tauqueer's explicit instruction**, only after part completion.
- **Commit message style: normal, plain, human.** Imperative mood, concise subject, optional short body explaining the "why."
- **Do not mention phase numbers or part numbers** in commit messages, code comments, or PR titles. Describe the work in plain language (do not write "Phase 0", "Part 1.2", "1.6", and so on). Those labels live only in the plan docs Tauqueer uses to name work.
- **No AI attribution of any kind.** Do not add `Co-authored-by`, "Generated with", "Co-authored by an AI", tool banners, or emojis to commit messages.
- Never skip hooks, never force-push, never amend a pushed commit, never touch git config.
- One part per commit unless Tauqueer says otherwise.

---

## 5. Documents — read in this order

- [`docs/PRD.md`](docs/PRD.md) — Product Requirements. What we're building and for whom, scope in/out, success criteria.
- [`docs/TRD.md`](docs/TRD.md) — Technical Requirements & Design. **The locked decisions, architecture, data model, external services, risks, and future improvements.** This is the source of truth for how things are built.
- [`docs/PHASE_PLAN.md`](docs/PHASE_PLAN.md) — The build plan: Phase 0 (setup) plus 3 phases, each split into parts, each part with defined tasks, manual-test gates, and commit gates.
- [`docs/PHASE_1_PLAN.md`](docs/PHASE_1_PLAN.md) — Implementation-level plan for Phase 1 (parts 1.1–1.8). **Phase 1 is complete.**
- [`docs/PHASE_2_PLAN.md`](docs/PHASE_2_PLAN.md) — Implementation-level plan for Phase 2 (parts 2.1–2.9): BYO-LLM shim, Voice Agent bridge, browser audio, voice UI, barge-in, thinking cue, latency, Azure audio, and voice acceptance. **Phase 2 is complete**; §7–§9 hold the measured numbers and the open items.
- [`docs/PHASE_3_PLAN.md`](docs/PHASE_3_PLAN.md) — Implementation-level plan for Phase 3 (parts 3.1–3.12): failure handling, the read API, the app shell, the owner and personal dashboards, observability, the security review, Azure, multilingual, and voice-clone groundwork. **Parts 3.1–3.8 are done.**
- [`docs/PRODUCTION_PLAN.md`](docs/PRODUCTION_PLAN.md) — Production & growth roadmap (Phases 4–6): launch readiness (deploy, CI/CD, tests, access control, quotas, observability, data lifecycle, backups, security 2.0), then multi-tenant/scale/UX, then advanced capabilities. Folds in the tail of Phase 3 (deployment, multilingual, voice-clone, polish). Open product decisions live in its §2.

When code and docs disagree about *intent*, ask. When you need to know *how the system actually behaves*, read the code — never assume the MD files are still accurate about implementation details.

---

## 6. How to start with this codebase

**Phases 0, 1 and 2 are complete.** Typed chat works at `/chat` and a spoken call works at `/voice`. Failure handling, the read API, the personal app, the owner admin app, per-turn traces, the latency budget check, and the security review are in. Production-plan work for the test suite, waitlist, quotas, the post-quota live checks, data lifecycle (consent, export, delete, retention), local ops alerts, and the public `/status` page is done. **Do not start 4.2 or anything later until Tauqueer names the next part** from [`docs/PRODUCTION_PLAN.md`](docs/PRODUCTION_PLAN.md). Remaining Phase 3 parts start when he names one from [`docs/PHASE_PLAN.md`](docs/PHASE_PLAN.md).

Two things are deliberately off: blob audio archiving (`VOICE_AUDIO_PERSIST_ENABLED=false`, until there is a storage account) and the slower `BRAIN_MODE=chat` brain, kept as a switch. Spoken calls also need a live public worker URL (`BYO_LLM_PUBLIC_URL`, usually ngrok in local dev); if that tunnel is offline, Deepgram cannot reach the brain and the voice UI shows the think-failed message. See [`docs/PHASE_2_PLAN.md`](docs/PHASE_2_PLAN.md) §7–§9 for the measured numbers and what the code taught us that the plan had wrong.

Install and run (after copying `.env.example` to `.env` and filling secrets):

```bash
# JS workspaces (frontend + gateway)
npm install
npm run typecheck
npm run lint
npm test
npm run test:worker

# Python worker (uv pins CPython 3.12 via worker/.python-version)
cd worker && uv sync
uv run ruff check src
uv run python -m worker.engram.probe   # live Engram wrapper check (needs Engram keys)
uv run python -m worker.reframe.probe # live reframe check (needs OpenAI keys)
cd ..
npm run controller   # controller speak/silence probe
npm run reframe      # reframe probe
npm run chat         # two-turn live typed-loop probe
npm run byo          # Chat Completions shim probe (needs Engram + OpenAI)
npm run brains       # Same questions through both BRAIN_MODE paths, side by side
npm run voice        # Voice Agent handshake + inject probe (needs Deepgram + public worker URL)
npm run call         # Full spoken call: synthesised speech in, STT, reply, interruption
npm run audio        # WAV container, capture boundaries, turn binding, blob read-back
npm run bargein      # Barge-in state machine (no services needed)
npm run failures     # Failure taxonomy and reconnect rules (no live outages)
npm run isolation    # Two signed-in users cannot reach each other's conversation
npm run nav          # Personal vs admin nav lists (from frontend/)
npm run budgets      # First-word p50/p90 vs budget, plus Engram request-log review
npm run observe      # Postgres/Redis health, optional gateway/worker ping, forced alert row
npm run security     # Cookie/CORS/secrets, think-endpoint unauth, OpenAPI hidden, then isolation
npm run admin -- show

# Dev processes (need a filled .env; bind ports come from that file)
npm run infra:up       # Postgres + Redis (or: make infra-up)
npm run migrate        # apply infra/migrations (or: make migrate)
npm run retain         # delete ended sessions older than RETENTION_SESSION_DAYS
npm run smoke          # external + local infra checks (or: make smoke)
npm run dev:frontend    # Vite, FRONTEND_ORIGIN (5188)
npm run dev:gateway     # GATEWAY_PORT (4100; Vite proxies /auth /api /ws)
npm run dev:worker      # WORKER_PORT (8000)

# Stop / wipe local data volumes
npm run infra:down
npm run infra:reset
```

`npm run lint` checks gateway + `frontend/vite.config.ts`. The copied component-library sources under `frontend/src` are excluded so Biome does not rewrite that tree.

- npm workspaces at the repo root. Packages: `frontend/`, `gateway/`. Worker is Python (uv) and is not in the JS workspace.
- `frontend/` — React 18 + Vite + Tailwind UI. Landing is `/`. Public `/status` shows live health (no sign-in). Signed-in members use `/dashboard` (Home, Chat, Voice); unapproved Google accounts land on `/waitlist` with no `users` row. `/admin` is a separate owner-only app. The Metacognition gallery is not in this repo — take primitives from `Desktop/component-library` when a screen needs one. Notes: `frontend/COMPONENT_LIBRARY.md`.
- `gateway/` — TypeScript service: Google auth, chat HTTP, admin proxy. Phase 2 adds the WebSocket bridge to Deepgram.
- `worker/` — Python (uv, `pyproject.toml`, `src/worker/`): Engram wrapper, reframe, controller, `POST /internal/turn`, and the OpenAI-compatible BYO-LLM endpoint Deepgram calls. `BRAIN_MODE` selects which Engram call answers a turn; see [TRD](docs/TRD.md) §1.2.
- `infra/` — Docker Compose, migrations, scripts.
- `docs/` — PRD, TRD, phase plans.

External services you must have credentials for (Tauqueer holds the accounts): Deepgram, Engram, OpenAI (or the configured reframe LLM), Azure Blob Storage, Google OAuth. All secrets come from environment/config. Google Sign-In is required to boot the gateway. Azure and Deepgram stay optional until the Phase 2 parts that use them; `npm run smoke` reports `SKIP` for those until the keys are set. Engram and OpenAI are required for the live brain (typed chat and voice).

---

## 7. Engineering principles (hard rules)

- **No hardcoding.** No magic values baked into logic. Everything configurable comes from config/environment.
- **No rule-based heuristics, no keyword matching, no intent if/else.** The controller's speak/silence decision and any understanding of the user must come from model outputs or structured signals — never from string/keyword matching or hand-written "if it contains X" logic. Infrastructure thresholds that are not language understanding (e.g. VAD/endpointing milliseconds, max tokens, timeouts, HTTP status handling) are allowed and expected.
- **Build for production, not just to pass a demo.** No "TODO later" holes in a part you called done.
- **Reference the code, not the docs, for behavior.** Keep docs updated when you change intent, but trust the code as ground truth.
- **Use Context7 MCP for any library/API documentation, setup, or configuration lookups** (Engram SDK, Deepgram, OpenAI, etc.). If Context7 MCP is not connected in your session, say so and set it up before relying on memory. The Engram alpha docs (<https://engram-docs-alpha.netlify.app/llms.txt>) and Deepgram docs (<https://developers.deepgram.com/>) are the authoritative fallback.
- **Respect Engram's contracts:** never build tenant strings by hand; use the persona endpoints; carry `session_id` across a conversation; read `tenant` off each retrieve row. See the TRD.

---

## 8. Definition of done for a part

A part is done when: every task in it is implemented to production quality, it adheres to the principles above, the manual test (if any) passes, and Tauqueer has been shown the result. Only then may a commit happen — and only if Tauqueer says so.
