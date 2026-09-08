# AGENTS.md — Read this first, every time

This is the entry point for any agent (human or AI) working in this repository. Read this file in full before touching anything. It tells you what the project is, which documents govern it, how to start, and the non-negotiable working rules.

If a rule here conflicts with a general instinct you have, this file wins.

---

## 1. What this project is

A voice bot you can talk to that speaks as a **persona** with real long-term memory. Speech is handled by Deepgram, the persona brain and memory are handled by Engram, and a small reframing LLM turns the persona's recalled answer into natural spoken output.

The one-line data flow for the shipping architecture (Aura sittings). A persona with a Fish voice id uses Deepgram for STT and Fish Audio for TTS — full detail is in the TRD, not this summary.

```
browser mic -> Deepgram Voice Agent API (STT + TTS + turn-taking + barge-in)
            -> BYO-LLM shim (controller -> Engram memory -> speaking LLM, streamed)
            -> Deepgram speaks the reply as the words are produced
```

Do not infer architecture from this summary — read the TRD.

---

## 2. Owner and control

- **Owner: Tauqueer.** He directs all work.
- **Tauqueer decides which phase and which part to start.** Never pick the next part yourself. Never jump ahead, and never work more than one part at a time unless he says so.
- If a part is ambiguous or you hit a real decision point, **stop and ask Tauqueer** rather than guessing.

---

## 3. Working loop (follow exactly)

1. Tauqueer names a **phase** and a **part** from [`docs/PHASE_6_PLAN.md`](docs/PHASE_6_PLAN.md) (sittings left in [`docs/PHASE_5_PLAN.md`](docs/PHASE_5_PLAN.md) or a part from [`docs/ENGRAM_PRIVATE_ROLLOUT.md`](docs/ENGRAM_PRIVATE_ROLLOUT.md) / [`docs/FUTURE.md`](docs/FUTURE.md) only when he names those files).
2. Complete **only that part** — its subparts in order, nothing from later parts.
3. After **each subpart**: run the automated checks that cover the change, then a logic check of the diff (config, no keyword understanding, isolation/fail-closed).
4. After the last subpart: **tell Tauqueer** whether a manual sitting is needed (live call, real Fish id, browser). If the part lists a Manual test, walk him through it and wait until it passes. If it lists none, say so. If UI changed, verify in the browser. Do not mark the part done until that is settled.
5. **Then commit that part** (see §4) and **stop** until Tauqueer names the next part. Do not wait for a second “please commit” on this working loop. Do not start the next part in the same sitting. Docs process: [`docs/WORKFLOW.md`](docs/WORKFLOW.md).

---

## 4. Commit rules

- **One part per commit**, after the part is complete and its manual test (if any) has passed. On the current working loop that commit happens at the end of the part; Tauqueer does not also have to say “commit.” If he names work outside that loop, do not commit until he says so.
- **Commit message style: normal, plain, human.** Imperative mood, concise subject, optional short body explaining the "why."
- **Do not mention phase numbers or part numbers** in commit messages, code comments, or PR titles. Describe the work in plain language (do not write "Phase 0", "Part 1.2", "1.6", and so on). Those labels live only in the plan docs Tauqueer uses to name work.
- **No AI attribution of any kind.** Do not add `Co-authored-by`, "Generated with", "Co-authored by an AI", tool banners, or emojis to commit messages.
- Never skip hooks, never force-push, never amend a pushed commit, never touch git config.

---

## 5. Documents — read in this order

Full map and Diátaxis roles: [`docs/README.md`](docs/README.md). How we update docs: [`docs/WORKFLOW.md`](docs/WORKFLOW.md).

1. [`docs/CONTEXT.md`](docs/CONTEXT.md) — Where we are (shipped vs current vs parked).
2. [`docs/decisions/README.md`](docs/decisions/README.md) — Why. Do not re-litigate Accepted records.
3. [`docs/PHASE_6_PLAN.md`](docs/PHASE_6_PLAN.md) — **Current work** (cloned Fish voices, then member UI). Tauqueer names a part from this file.
4. [`docs/PRD.md`](docs/PRD.md) / [`docs/TRD.md`](docs/TRD.md) / [`docs/ENGRAM.md`](docs/ENGRAM.md) — what, how, memory contract. Isolation extras: [`docs/ENGRAM_MEMBER_PRIVATE_WORKAROUND.md`](docs/ENGRAM_MEMBER_PRIVATE_WORKAROUND.md); named rollout: [`docs/ENGRAM_PRIVATE_ROLLOUT.md`](docs/ENGRAM_PRIVATE_ROLLOUT.md).
5. [`docs/PHASE_PLAN.md`](docs/PHASE_PLAN.md) — current vs shipped vs later. Personas leftover sittings: [`docs/PHASE_5_PLAN.md`](docs/PHASE_5_PLAN.md) §4. History: [`docs/SHIPPED.md`](docs/SHIPPED.md). Parked / Plan X: [`docs/FUTURE.md`](docs/FUTURE.md) — do not start until named.

When code and docs disagree about *intent*, ask. When you need to know *how the system actually behaves*, read the code — never assume the MD files are still accurate about implementation details.

---

## 6. How to start with this codebase

**Phases 0–4 product work are complete.** Typed chat works at `/chat` and a spoken call works at `/voice`. Failure handling, the read API, the personal app, the owner admin app, per-turn traces, the latency budget check, the security review, the test suite, waitlist, quotas, data lifecycle, local ops alerts, and public `/status` are in. **Personas are built end to end**: many local rows; create or link, teach, ingest, publish, unpublish-with-confirmation and destroy on `/admin/persona`; pickers on `/chat`, `/voice`, `/dashboard` and the owner conversation list, with sittings and memory pinned to that persona; first talk joins Engram People, stores Engram's `user_id`, subscribes that persona and fails closed. Automated checks (`npm test`, `isolation`, `security`, `failures`) are green. Live sittings left from that work: [`docs/PHASE_5_PLAN.md`](docs/PHASE_5_PLAN.md) §4. Engram-side per-member private memory works as of 8 Sep 2026: each member authenticates with their own session token, so their turns land in their own private pool, and a member we cannot credential degrades to shared-only rather than falling back to the key owner ([`docs/ENGRAM.md`](docs/ENGRAM.md) §2.3, §11). Read [`docs/ENGRAM_PRIVATE_ROLLOUT.md`](docs/ENGRAM_PRIVATE_ROLLOUT.md) before touching memory.

**Current work is [`docs/PHASE_6_PLAN.md`](docs/PHASE_6_PLAN.md)** (cloned Fish voices, then member UI). Do not start [`docs/FUTURE.md`](docs/FUTURE.md) until he names it. Azure deploy is last of all.

Two things are deliberately off: blob audio archiving (`VOICE_AUDIO_PERSIST_ENABLED=false`, until there is a storage account) and the slower `BRAIN_MODE=chat` brain, kept as a switch. Spoken calls also need a live public worker URL (`BYO_LLM_PUBLIC_URL`, usually ngrok in local dev); if that tunnel is offline, Deepgram cannot reach the brain and the voice UI shows the think-failed message. Measured numbers and what the code taught us: [`docs/SHIPPED.md`](docs/SHIPPED.md). Engram pools and isolation: [`docs/ENGRAM.md`](docs/ENGRAM.md).

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
npm run admin -- destroy --persona-id <uuid> --confirm <handle> # irreversible

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

External services you must have credentials for (Tauqueer holds the accounts): Deepgram, Engram, OpenAI (or the configured reframe LLM), Azure Blob Storage, Google OAuth, and Fish Audio when a persona uses a cloned voice. All secrets come from environment/config. Google Sign-In is required to boot the gateway. Azure and Deepgram stay optional until those keys are set; `npm run smoke` reports `SKIP` until then. Engram and OpenAI are required for the live brain (typed chat and voice). A Fish key is required only for sittings whose persona has a Fish voice id.

---

## 7. Engineering principles (hard rules)

- **No hardcoding.** No magic values baked into logic. Everything configurable comes from config/environment.
- **No rule-based heuristics, no keyword matching, no intent if/else.** The controller's speak/silence decision and any understanding of the user must come from model outputs or structured signals — never from string/keyword matching or hand-written "if it contains X" logic. Infrastructure thresholds that are not language understanding (e.g. VAD/endpointing milliseconds, max tokens, timeouts, HTTP status handling) are allowed and expected.
- **Build for production, not just to pass a demo.** No "TODO later" holes in a part you called done.
- **Reference the code, not the docs, for behavior.** Keep docs updated when you change intent, but trust the code as ground truth.
- **Use Context7 MCP for any library/API documentation, setup, or configuration lookups** (Engram SDK, Deepgram, OpenAI, Fish Audio, etc.). If Context7 MCP is not connected in your session, say so and set it up before relying on memory. The Engram alpha docs (<https://engram-docs-alpha.netlify.app/llms.txt>), Deepgram docs (<https://developers.deepgram.com/>), and Fish Audio docs (<https://docs.fish.audio/llms.txt>) are the authoritative fallback.
- **Respect Engram's contracts:** never build tenant strings by hand; use the persona endpoints; carry `session_id` across a conversation; read `tenant` off each retrieve row. Full map: [`docs/ENGRAM.md`](docs/ENGRAM.md).

---

## 8. Definition of done for a part

A part is done when: every subpart is implemented to production quality, it adheres to the principles above, the automated checks and logic check have passed, Tauqueer has been asked whether a manual sitting is needed and that sitting (if any) has passed. Then commit (see §4) and stop. Do not start the next part until he names it.
