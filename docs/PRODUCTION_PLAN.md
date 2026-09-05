# Production & Growth Plan — Phases 4–6

End-to-end plan to take the voice persona bot from "works for 2–3 testers on a laptop" to "safe to launch for many real users, and good enough that they come back." Owner: Tauqueer. Read [AGENTS.md](../AGENTS.md), [PRD.md](PRD.md), [TRD.md](TRD.md), and [PHASE_PLAN.md](PHASE_PLAN.md) first.

This document supersedes the tail of Phase 3: **the deployment, multilingual, voice-clone and polish parts (3.9–3.12) are folded into the phases below** so there is one production roadmap instead of two. Phases 0–3.8 stay as they are.

> Goal of this plan: a stranger can be invited, sign in, have a private spoken conversation that no one else can reach, come back tomorrow and be remembered — and the team can deploy, watch, bill (if we choose to), and recover it without heroics.

---

## 0. How to use this document

- Same working loop as the rest of the repo ([AGENTS.md](../AGENTS.md) §3): **Tauqueer names a phase and a part; do only that part.** This file is the roadmap and intent; implementation-level detail for a part is written when that part is named.
- **Hard rules still apply** ([AGENTS.md](../AGENTS.md) §7): everything configurable comes from config; no keyword/intent heuristics; no "TODO later" holes in a finished part; reference the code, not the docs, for behaviour.
- **Do not mention phase/part numbers in commits or code.** They live here.

---

## 1. Where the product is today (ground truth from the code)

**Working:** typed chat (`/chat`), spoken calls (`/ws/voice`) with barge-in and streamed replies, the canonical Postgres record, per-turn tracing, the personal app (`/dashboard`) and the owner admin app (`/admin`), failure handling, the read API, latency budgets, and the security/isolation review. Isolation rests on `sessions.user_id` plus the worker `TurnRunner` identity match; the memory panel now re-verifies identity too. Gateway per-IP rate limiting and a worker internal-secret brute-force throttle are in. The offline test suite (4.3), waitlist access (4.4), daily member quotas and write receipts (4.5), and the post-4.5 live checks are in and signed off. `OWNER_EMAILS` are not capped. The think request log takes `session_id` from `LOG_TURN_FIELDS` only.

**Not yet built (the gap this plan closes):**


| Area            | Today                                                            | Needed for launch                                                     |
| --------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------- |
| Deployment      | Laptop + ngrok tunnel; Blob archiving off                        | Azure Container Apps, managed Postgres/Redis, Blob on, tunnel retired |
| CI/CD           | None                                                             | Build + test + lint + typecheck + migrate + deploy pipeline           |
| Automated tests | Vitest + pytest with a coverage gate; probes stay as live smoke  | Keep the floor; turn probes into e2e against staging                  |
| Member access   | Waitlist; owners auto-approved; People queue on `/admin/people`  | Same model on the Azure deploy                                        |
| Personas        | Exactly one active persona (`resolveActivePersona` throws on >1) | Support many personas cleanly, even if launch ships one               |
| Data lifecycle  | None                                                             | Delete-my-data, export, retention, consent, privacy/ToS               |
| Observability   | Logs + budget probe + per-turn correlation id                    | Error tracking, metrics, uptime/synthetic checks, alerts              |
| Abuse / cost    | Member daily caps, receipts, per-user rate-limit keys            | Cost dashboards; billing only if we charge                            |
| Resilience      | Single instances                                                 | Backups, restore runbook, horizontal scale, load test                 |
| UX polish       | Functional                                                       | Onboarding, empty/error states, mobile, accessibility                 |


---

## 2. Decisions (confirmed with Tauqueer)

- **D-A Access model — waitlist.** Anyone can request access; the owner approves in batches. Until approved, a sign-in does not become a member and creates no private pool. (Part 4.4.)
- **D-B Personas — one now, multi-ready.** Launch ships one persona, but the single-persona assumption (`resolveActivePersona` throwing on >1) is removed in Phase 5 so more personas need no rewrite. (Part 5.1.)
- **D-C Monetization — free for now.** Free/internal at launch; billing is built later *only if* we decide to charge. Cost guardrails and quotas still ship at launch. (Parts 4.5, 5.5.)
- **D-D Compliance — GDPR-light.** Delete-my-data + export + consent at sign-in + a privacy/ToS page. No formal certification or data-residency work yet. (Part 4.7.)
- **D-E Cloud — Azure.** Per TRD D17. (Part 4.1.)
- **D-F Auth providers — Google-only at launch** (assumed; extra providers are optional in Part 5.4).
- **D-G Data region — single region** (assumed; multi-region is a later call).

**First feature bets (pull these forward in Phases 5–6):** the "what it remembers about me" + edit/forget memory view, multilingual/code-switch, owner analytics, and trust & safety (report a reply + guardrails).

---

## Phase 4 — Launch readiness (make it safe to invite strangers)

Goal: the product can be put in front of real, external users without a data leak, a silent outage, or a laptop in the loop. This is the "GA hardening" phase and it absorbs the old 3.9 and 3.12.

### Part 4.1 — Azure deployment (retire the tunnel)

- Goal: gateway, worker and frontend run on Azure; audio archiving is on.
- Tasks: `Dockerfile` per service; Container Apps for all three; Azure Database for PostgreSQL and Azure Cache for Redis (private networking where possible); Azure Blob provisioned and `VOICE_AUDIO_PERSIST_ENABLED=true`; migrations run as a deploy step (forward-only, existing runner); secrets from Azure Key Vault, never baked into images; **worker `/internal/`* reachable only from the gateway (private ingress); only the BYO-LLM think path is public** (the split-ingress decision from the security review).
- Manual test: a staging deploy serves a full spoken call from a browser, both audio blobs are fetchable, `npm run smoke` reports Azure `OK`.

### Part 4.2 — CI/CD pipeline

- Goal: every change is built, checked and shipped the same way.
- Tasks: pipeline that runs typecheck, lint (Biome + Ruff), the test suite (4.3), and a migration dry-run on every PR; builds and scans images; deploys to staging on merge and to prod on a tag/approval; dependency pinning and an audit step (`npm audit`, `uv`/pip audit); rollback path documented.
- Manual test: a PR is blocked by a failing test; a merge deploys to staging automatically.

### Part 4.3 — Automated test suite

**Goal.** Behaviour is protected by fast tests, not just manual probes. Probes stay as live/e2e smoke.

**Subparts.**

| Subpart | What |
| --- | --- |
| 4.3.1 | Runners: Vitest (gateway + frontend), pytest (worker). Root `npm test` and `npm run test:worker`. Coverage floors in `config/test-coverage.json`. |
| 4.3.2 | Gateway: auth/owner guards, session cookie record, session ownership, insights parse + list/detail scope, rate-limit plugin options. |
| 4.3.3 | Worker: controller decisions, turn identity match, Engram wrapper vs a fake SDK, reframe/answer fact-lock request shape, internal-auth throttle. |
| 4.3.4 | Frontend: nav config, session-from-`/api/me` state, memory panel reload key + refetch when `me.id` changes. |
| 4.3.5 | Run the suite and a logic check. No live vendors. |

**Files.**
- `config/test-coverage.json` — line/function/branch/statement floors.
- `gateway/vitest.config.ts`, `frontend/vitest.config.ts`, worker `[tool.pytest.ini_options]` / `[tool.coverage]`.
- Extracted units (same behaviour, testable without vendors): `gateway/src/auth/rateLimit.ts`, `gateway/src/insights/scope.ts`, `worker/src/worker/turn/identity.py`, `frontend/src/lib/sessionState.ts`, `frontend/src/lib/memoryPanel.ts`.
- Tests next to gateway/frontend source (`*.test.ts`); worker tests in `worker/tests/`.

**Logic.**
- Unit layer never calls Engram, OpenAI, Deepgram, or a live DB/Redis.
- Coverage include lists are the modules this part is meant to protect, not the Deepgram bridge.
- `sessionListScope` / `sessionDetailScope`: personal views always pass the viewer's id; owner views pass `null` and may filter by an explicit user id.
- Turn identity: `session_mismatch` / `persona_mismatch` / `identity_mismatch` are compared UUIDs and stored Engram ids, not string matching on text.

**Config.** Coverage floors in `config/test-coverage.json`. Test Vite env is the same `VITE_*` values as `.env.example`.

**Errors.** A failing test or a miss on the coverage floor fails `npm test` / `npm run test:worker`.

**Manual test.** `npm test` and `npm run test:worker` both pass. Coverage meets the configured floor. Probes are unchanged.

**Done when.** The suite runs offline and pins the isolation/auth/controller contracts. **Implemented.**

### Part 4.4 — Member access control (waitlist)

**Goal.** Not every Google account gets in. Access is deliberate (**D-A: waitlist**). Until the owner approves, a sign-in creates no `users` row and no Engram pool.

**Subparts.**

| Subpart | What |
| --- | --- |
| 4.4.1 | `access_requests` migration + `ACCESS_STATUS` in `schema.ts`. Backfill existing `users` as `active`. |
| 4.4.2 | Pure sign-in and batch-decision units. Redis session kinds (`member` / `waitlist` / `refused`); `{ app_user_id }` still means member. |
| 4.4.3 | Auth callback gate: owners and approved/active identities provision; others waitlist or refuse. `/api/me` works without a `users` row. `requireAppUser` stays member-only and re-checks so a revoke kills a live cookie. |
| 4.4.4 | Owner queue: list + batch approve/deny/revoke. Cannot waitlist an owner, revoke-of-self, or treat `subscriptions` as a gate. |
| 4.4.5 | Frontend: session states, `/waitlist` card, People queue + batch actions. Copy and path from config. |
| 4.4.6 | Unit tests + logic check. No live Google / Engram. |

**Files.**
- `infra/migrations/0006_access_requests.sql`
- `gateway/src/access/decision.ts`, `gateway/src/access/me.ts`, `gateway/src/access/store.ts`, `gateway/src/access/parse.ts`
- `gateway/src/routes/access.ts`
- `frontend/src/lib/sessionState.ts`, `frontend/src/app/shell/AccessCard.tsx`, People page queue

**Logic.**
- States: `requested` → `approved` → `active`, plus `denied` / `revoked`.
- Owner emails (`OWNER_EMAILS`) always provision and cannot be denied or revoked.
- Provision (upsert user + subscribe + `active` row) happens only on the OAuth callback, never on `/api/me`.
- `/api/me` re-reads Postgres: a live member cookie whose row is `revoked`/`denied` returns that access state; product routes stay 401.
- Roles stay owner vs member. `subscriptions` stays visibility-only.

**Config.** `WAITLIST_PATH`, `/api/me` access labels, batch action tokens, queue default status, error strings, frontend `VITE_WAITLIST_*` / `VITE_ACCESS_*` copy.

**Errors.** Unauthenticated `/api/me` is 401. Product `/api/*` still requires a member. Batch rejects owner-protected, self-revoke, and illegal transitions with configured codes.

**Manual test.** A new Google account lands on the waitlist with no `users` / pool row; the owner batch-approves; the next sign-in becomes a member; denied/revoked accounts see a clear refuse message. Existing owner and tester still sign in after backfill.

**Done when.** Unapproved sign-in cannot reach chat, voice, or memories, and the owner can admit or refuse from People. **Done.** Live waitlist and People checks signed off (see the backlog below).

### Part 4.5 — Quotas, idempotency & abuse controls

**Goal.** One user (or a retried write) cannot exhaust Engram/OpenAI/Deepgram spend or hammer the door.

**Subparts.**

| Subpart | What |
| --- | --- |
| 4.5.1 | Daily per-user quotas for members: user-speaker turns and overlapping voice minutes. `0` disables a cap. `OWNER_EMAILS` are not capped. Calendar day in `QUOTA_TIMEZONE`. |
| 4.5.2 | Enforce in `TurnRunner._begin` before the brain; gateway chat refuses with the same count so typed chat never spends on a known overage. 429 `{ error, code, reset_at }`. |
| 4.5.3 | `write_receipts` unique on `(session_id, correlation_id)`. Persist and converse write-back run at most once per receipt. Chat accepts an optional `correlation_id` so a retry can reuse it. |
| 4.5.4 | Cookie plugin before rate-limit. `keyGenerator` uses `user:{id}` when the session is a member, otherwise IP. |
| 4.5.5 | Structured warn log when usage crosses `QUOTA_WARN_RATIO`. Paging stays later. |
| 4.5.6 | Unit tests + logic check. No live vendors. |

**Logic.**
- Count only `speaker = user` turns. Voice minutes clamp each session to the calendar window (`started_at` → `ended_at` or now).
- A limit of `0` is off. `OWNER_EMAILS` accounts are not capped. Members still are.
- Receipts are claimed in the persist transaction; a second finish with the same ids returns the stored turn ids and does not converse again.
- Rate-limit key is a configured prefix plus user id or IP. No request-body matching.

**Config.** Env defaults: `QUOTA_TURNS_PER_DAY`, `QUOTA_VOICE_MINUTES_PER_DAY`, `QUOTA_TIMEZONE`, `QUOTA_WARN_RATIO`, error strings/codes, rate-limit key prefixes. The owner can override the four live values from admin Overview; that write is `quota_settings` and is read on the next turn (no restart).

**Manual test.** Save a turn cap of 1 on admin Overview. The next extra chat turn is 429 `{ error, code, reset_at }` and logs `quota refused`. A retried chat/think write with the same correlation id does not double-record.

**Done when.** Caps and receipts are server-side, messages are honest, and per-user rate-limit keys are used when a member cookie is present. **Done.** Owners skip the cap. Live quota and receipt checks signed off (see the backlog below).

### After 4.5 — Manual test backlog

**Complete.** Tauqueer signed the list off. Offline `npm test` / `npm run test:worker` passed. Migrations `0006_access_requests.sql`, `0007_write_receipts.sql`, and `0008_quota_settings.sql` are applied. Live waitlist, quota, and spoken-think checks are done. A think-handler log that passed `session_id` twice returned 500 to Deepgram (`FAILED_TO_THINK` / "The persona could not answer"); that collision is fixed. Do not start 4.6, 4.7, 4.1–4.2, 4.8–4.9, or Phase 5/6 until Tauqueer names the next part.

**4.3 — re-run the suite**

- [x] `npm run lint` and `npm run typecheck` pass.
- [x] `npm test` and `npm run test:worker` pass. Coverage still meets `config/test-coverage.json`.
- [x] Existing probes are unchanged (`npm run isolation`, `npm run security` still exist; do not replace them).

**4.4 — live waitlist**

- [x] New Google sign-in lands on `/waitlist`. No `users` row. No Engram pool / subscribe.
- [x] Owner batch-approves on `/admin/people`. Next sign-in becomes a member and can use chat/voice.
- [x] Denied or revoked account sees the refuse card; product `/api/*` stays 401.
- [x] Existing owner and tester still sign in after the `active` backfill.
- [x] Click-through: waitlist card, People queue (approve/deny/revoke), personal vs admin frames. Landing does not bounce a waitlisted account to `/dashboard`.
- [x] Revoke of a live member cookie is refused on the next product request. Cannot revoke-of-self or deny/revoke an `OWNER_EMAILS` account.

**4.5 — live quotas and write receipts**

- [x] On `/admin`, set turns per day to `1` and save. Send two chat turns. Second is 429 `{ error, code, reset_at }` and logs `quota refused` (or the configured event name).
- [x] POST `/api/chat` twice with the same `correlation_id`. One user-speaker turn row. Converse write-back does not double.
- [x] Optional: a spoken turn after the turn cap — think refuses, no extra Engram spend. Owner accounts are not capped.
- [x] Member cookie rate-limit key is `user:{id}`; signed-out traffic still keys by IP.

**Done when.** Every box above is checked with Tauqueer. **Done.** The next named part starts when he says so.

### Part 4.6 — Observability, monitoring & alerting

- Goal: we find out about problems before users tell us.
- Tasks: error tracking (e.g. Sentry) in gateway, worker and frontend; a metrics surface and dashboards (turn latency, error rate, call volume, dependency health); uptime/synthetic checks that place a scripted call; alerting to a channel/on-call; ship structured logs somewhere queryable. Correlation id (already minted) flows into traces.
- Manual test: a forced dependency failure raises an alert and appears in the dashboard within the configured window.

### Part 4.7 — Data lifecycle & privacy

- Goal: a user can leave and take/erase their data; we can say what we keep and why.
- Tasks (per **D-D**): delete-my-data (app rows + the user's Engram **private** pool via the persona admin surface, `forget_user_memory` / per-user purge; audio blobs; sessions/turns) with a confirmation flow; export-my-data (transcripts + memory); a retention policy applied by a scheduled job; consent capture at sign-in; a privacy policy and terms page; cookie/notice copy. Owner tooling to action a deletion request.
- Manual test: a member deletes their account; their sessions, turns, audio and private memories are gone and a re-sign-in starts empty; export produces a complete archive.

### Part 4.8 — Backups & disaster recovery

- Goal: we can restore after data loss.
- Tasks: automated Postgres backups with a tested restore; document Redis as ephemeral (and what a flush costs); Blob lifecycle/retention; a written DR runbook (RPO/RTO targets, restore steps, contacts). Secrets rotation procedure.
- Manual test: a restore drill brings a throwaway environment back from a backup and a call works.

### Part 4.9 — Security hardening 2.0

- Goal: close the gaps a real internet exposes.
- Tasks: security headers (CSP, HSTS, X-Content-Type-Options, Referrer-Policy) on the frontend/gateway; dependency and image vulnerability scanning wired into CI; secret rotation runbook; a pre-launch pen-test checklist; confirm the public think endpoint posture live (`public_think_unauth=ok 401`) and add per-route limits where useful; review CORS/cookie posture for the production topology (same-site vs cross-site per the security review).
- Manual test: `npm run security` passes against staging including the live public-think check; headers verified; scanners clean or triaged.

**Phase 4 done when:** an invited stranger can sign in on the deployed app, hold a private spoken conversation, be remembered tomorrow, delete their data, and none of it is reachable by anyone else — and the team is alerted if any of it breaks.

---

## Phase 5 — Multi-tenant, scale & growth (make it good, for many)

Goal: more than one persona, more than a handful of users, and an experience people choose to return to.

### Part 5.1 — Multi-persona

- Goal: the app hosts several personas cleanly.
- Tasks: remove the single-active-persona assumption (`resolveActivePersona`); a persona directory/picker; per-persona voice config already exists — make it authoritative; subscriptions become meaningfully per-persona; admin manages many personas; personal history and memory scoped per (user, persona). Isolation invariants extended and re-probed.
- Manual test: a user talks to two different personas; each keeps its own memory of the user; the isolation probe covers per-persona scoping.

### Part 5.2 — Scale & performance

**with a catch.** Local schema + UI is fine. Engram private-pool purge needs their admin/forget APIs. Blob delete is a no-op until audio is on.

- Goal: hold up under real concurrency.
- Tasks: load test the voice path; tune DB pool sizes, Engram client cache, and worker concurrency; autoscaling rules for gateway/worker; verify WebSocket scale (the Redis notice channel already decouples worker→gateway); backpressure and graceful shedding under overload.
- Manual test: a load test at the target concurrency stays within the latency budget and error-rate threshold.

### Part 5.3 — Onboarding & UX polish

- Goal: first run is obvious; failures are legible; it works on a phone.
- Tasks: first-run/empty states; a mic-permission coaching flow; toast/error surfaces and loading skeletons; a React error boundary; a mobile-responsive pass; accessibility pass (WCAG AA: keyboard nav, focus states, ARIA, contrast); reduced-motion support. Copy from config, not hardcoded.
- Manual test: a new user completes their first call on mobile with no dead ends; keyboard-only and screen-reader spot checks pass.

### Part 5.4 — Accounts & preferences

- Goal: users can manage themselves.
- Tasks: profile (display name, avatar), preferences (voice, language when 6.1 lands, notifications), session management/sign-out-everywhere; optional extra auth providers per **D-F**.
- Manual test: a user changes their voice/name and it takes effect; preferences persist across sessions.

### Part 5.5 — Billing & usage (only if we charge — **D-C**)

- Goal: meter and monetize.
- Tasks: usage metering per user (turns/minutes), plans and quotas, a payments integration (e.g. Stripe), a usage dashboard for the user and the owner, dunning/grace behaviour. Ties into 4.5 quotas.
- Manual test: a user on a plan is metered correctly; hitting a plan limit behaves per policy.

### Part 5.6 — Growth loops

- Goal: reasons to come back and to invite others.
- Tasks (menu, pick per priority): session summaries / email recaps of a conversation; shareable highlight clips (respecting privacy); referral/invite flow; re-engagement notifications; "continue where you left off." All privacy-aware.
- Manual test: the chosen loop works end to end and never leaks another user's content.

---

## Phase 6 — Advanced capabilities (differentiate)

Goal: the features that make this more than a demo. Pull from this as priorities dictate; absorbs old 3.10/3.11.

- **6.1 Multilingual (code-switch).** `language=multi` with endpointing tuned for code-switch; config, not a code branch (verify Nova-3 support at build time). *(was 3.10)*
- **6.2 Voice cloning.** Voice as a property of the persona (seam exists in `voice_config`); a path to a cloned voice. *(was 3.11)*
- **6.3 Richer controller.** Safety filter, end-session, human handoff, tool use — still model/signal driven, never keyword heuristics.
- **6.4 More channels.** Telephony / WhatsApp / native mobile (each a real project; gate on demand).
- **6.5 Owner analytics.** Engagement, retention cohorts, memory-growth, per-persona quality signals — built on the canonical record, no keyword grouping.
- **6.6 User-shaped personas.** Let trusted users create or teach personas (large; strong isolation and moderation implications).

---

## 3. Feature & UX backlog (a menu to pull into the phases above)

Not all of these will ship; they are candidates so we choose deliberately.

- **Conversation UX:** live captions with speaker labels; a "what does it remember about me?" memory view (already partially in the panel); per-turn "why did it say that" (grounding sources) for the owner; edit/correct a memory; pin/forget a specific memory.
- **Voice UX:** push-to-talk vs open-mic toggle; visual VU + thinking cue polish; choose persona voice; adjustable speaking rate; a text fallback mid-call.
- **Trust & safety:** report a reply; content/safety guardrails in the controller; rate-limit feedback that is friendly, not scary; clear "your data" controls.
- **Retention:** daily/weekly recap email; streaks; "ask me anything" prompts; resume-last-conversation.
- **Admin/owner:** persona quality dashboard; conversation search; flagged-turn review queue; invite management; per-user quota overrides; feature flags.
- **Platform:** feature-flag system; A/B of brain modes (the `brain_mode` split already exists); internationalized UI copy; theming (dark/light); PWA/installable.

---

## 4. Cross-cutting definition of done (Phases 4–6)

- Every new value is config; no magic numbers or duplicated strings; **no keyword/intent heuristics anywhere.**
- Isolation is enforced server-side on every read/write path and covered by an automated test; UI filtering is never the control.
- New behaviour ships with tests; the coverage gate holds.
- Docs updated in the same change as the behaviour they describe.
- Nothing that touches user data ships without a delete/export story.

---

## 5. Sequencing (Tauqueer's call)

**Azure deployment (4.1) comes last — after everything else in Phase 4 is complete.** Everything that can be built and tested locally lands first; the product moves to Azure only once it is fully hardened.

**Now:** 4.3 / 4.4 / 4.5 and the After 4.5 backlog are done. Wait for Tauqueer to name the next part.

Order of the rest: **4.7 data lifecycle → 4.6 observability → 4.2 CI/CD → 4.8 backups → 4.9 security 2.0 → 4.1 Azure deploy (last).**

Some sub-tasks can only be *finished* against real infra (the live public-think check in 4.9, managed-Postgres backups in 4.8, the deploy step of the pipeline in 4.2); those complete when 4.1 lands. Phase 5 begins once the beta is stable; Phase 6 is pulled by demand.