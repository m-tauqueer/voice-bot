# Shipped (history)

What already works. **Not a build plan.** Do not start work from this file. Ground truth for behaviour is the code. Current work: [PHASE_5_PLAN.md](PHASE_5_PLAN.md). Later work: [FUTURE.md](FUTURE.md). Engram: [ENGRAM.md](ENGRAM.md).

This digest replaces the completed task lists that used to live in `PHASE_PLAN.md`, `PHASE_1_PLAN.md`, `PHASE_2_PLAN.md`, `PHASE_3_PLAN.md`, and the done slices of `PRODUCTION_PLAN.md`, so agents do not treat old “do this part next” text as current work.

---

## Product today

Typed chat at `/chat`. Spoken call at `/voice` (Deepgram Voice Agent + BYO-LLM shim). Personal app at `/dashboard`. Owner app at `/admin`. Public `/status`. Waitlist Google sign-in. Daily member quotas (owners uncapped). Consent, export, delete-my-data, ended-session retention. Local ops alerts (`ops_events`). Isolation: `sessions.user_id` + published persona pin + worker identity match. Delete-my-data forgets and unsubscribes every persona that member used, not one active row. Daily member quotas stay per member. **Local catalog can store many personas.** Owner `/admin/persona` can create or link a second persona, teach and ingest the selected row, set a TTS voice id on `voice_config`, and publish or unpublish locally (no Engram delete). Live: Engram `create` 403 with this key → paste id and link; teach and document ingest on the selected row; local publish. Sign-in does not subscribe anyone. The first think for a sitting calls Engram subscribe for **that** persona, mirrors `subscriptions` on success, logs manage-scope 403 and continues, and fails the turn if retrieve/chat return not-subscribed. **Live-checked on `/voice`:** one subscribe attempt per persona, then talk. This worker key is `org_admin` but scoped to `memory:read`/`write` plus billing/members/metrics/tokens **read** — no `org:manage`, so Engram’s Subscribers list stays empty. Filling that list is still open (broader key or their dashboard), not more grant code. Chat, voice, dashboard history, memory, and the owner conversation list take a published persona pin; missing or unpublished is the same 404 as a missing session, and a missing pin on a session list returns an empty page (no mixed Ada+Nova). `GET /api/personas` lists published rows only — drafts stay off that list. Talk still requires a pick. Typed chat stores the sitting id per (user, persona). `ENGRAM_PERSONA_ID` is seed-only when the table is empty. Remaining persona work: [PHASE_5_PLAN.md](PHASE_5_PLAN.md).

Blob audio archiving is off (`VOICE_AUDIO_PERSIST_ENABLED=false`) until there is a storage account. `BRAIN_MODE=chat` is the slow switch; default is `retrieve`. Spoken calls need a live `BYO_LLM_PUBLIC_URL` (ngrok in local dev).

---

## Phases 0–1

Repo, npm workspaces + uv worker, Compose Postgres/Redis, config from `.env`, smoke checks. Postgres canonical record. Engram wrapper behind an interface. Google auth. Typed chat. Controller speak/silence (no keyword heuristics). Isolation on the session row.

---

## Phase 2 — voice (measured)

Shipping path: browser mic → gateway WS → Deepgram Voice Agent (Nova-3 STT, Aura-2 TTS, barge-in) → worker BYO-LLM (controller → Engram → speaking LLM, streamed) → speech as words arrive.

| Brain | Engram call | To first spoken word |
| --- | --- | --- |
| `retrieve` (default) | `personas.retrieve` ~0.7–1.5 s, converse write-back off the reply path | **~2.5–4 s** live (`npm run brains` **2.80 s**) |
| `chat` (switch) | `personas.chat` ~11 s generation | **~12.5–14.5 s** |

`top_k=25` (10 was thin). Reframe/answer streamed; clients warmed; session lock not held across the brain. Two in-flight turns share one claimed Engram `session_id`.

What the plan got wrong (keep this):

- `LatencyReport` is one field per message, merged at `AgentAudioDone`.
- `AgentThinking` is not emitted; do not hang on it.
- Interrupted audio may never send `AgentAudioDone`; a new agent turn must clear barge-in.
- Deepgram warns `SLOW_THINK_REQUEST` at 5 s; it does not drop the call.
- No audio → `CLIENT_MESSAGE_TIMEOUT`; probes must stream silence like a browser.
- Nova-3 Voice Agent listen has no `endpointing` knob (Flux/v2 only).

Blob path proven against Azurite; real Azure credentials still unexercised. Storage failure must not end a call.

---

## Phase 3.1–3.8

Failure handling and reconnect copy. Read API (personal history, owner reconstruct). App shell: landing, `/dashboard`, `/admin`. Per-turn traces / correlation id. Latency budget check (`npm run budgets`). Security review: cookie/CORS, think-endpoint unauth 401, OpenAPI hidden, isolation probe. Gateway rate limit + worker internal-secret throttle. Memory panel identity bind.

Not built in 3.x: Azure deploy, multilingual, voice-clone (those are [FUTURE.md](FUTURE.md)).

Engram subscribe is **not** an access gate today (this key 403s `org:manage` on subscribe and on listing subscribers). Isolation is app session + identity match. See [ENGRAM.md](ENGRAM.md) §4.

---

## Phase 4 product (launch-readiness, local)

Done: automated tests (Vitest + pytest, coverage floor); waitlist; daily quotas + write receipts; local ops alerts + public `/status`; data lifecycle (consent, export, delete, retention).

Not done (parked as Plan X in [FUTURE.md](FUTURE.md)): CI/CD, backups, security 2.0, Azure deploy.

---

## Decisions that still hold

Waitlist access (D-A). Catalog can store many personas; talk, history, and memory need a published pick (D-B). Free for now (D-C). GDPR-light (D-D). Azure later (D-E). Google-only (D-F). Single region (D-G).

Hard rules: config not magic values; no keyword/intent heuristics; never hand-build Engram tenant strings; carry persona `session_id`; text-only into Engram.
