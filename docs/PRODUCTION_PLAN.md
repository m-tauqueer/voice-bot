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

**Working:** typed chat (`/chat`), spoken calls (`/ws/voice`) with barge-in and streamed replies, the canonical Postgres record, per-turn tracing, the personal app (`/dashboard`) and the owner admin app (`/admin`), failure handling, the read API, latency budgets, and the security/isolation review. Isolation rests on `sessions.user_id` plus the worker `TurnRunner` identity match; the memory panel now re-verifies identity too. Gateway per-IP rate limiting and a worker internal-secret brute-force throttle are in.

**Not yet built (the gap this plan closes):**

| Area | Today | Needed for launch |
| --- | --- | --- |
| Deployment | Laptop + ngrok tunnel; Blob archiving off | Azure Container Apps, managed Postgres/Redis, Blob on, tunnel retired |
| CI/CD | None | Build + test + lint + typecheck + migrate + deploy pipeline |
| Automated tests | Only probe scripts | Unit + integration tests with a coverage gate; probes become e2e |
| Member access | Any Google account becomes a member | An explicit access model (invite / allowlist / waitlist) |
| Personas | Exactly one active persona (`resolveActivePersona` throws on >1) | Support many personas cleanly, even if launch ships one |
| Data lifecycle | None | Delete-my-data, export, retention, consent, privacy/ToS |
| Observability | Logs + budget probe | Error tracking, metrics, uptime/synthetic checks, alerts |
| Abuse / cost | IP rate limit + auth throttle | Per-user quotas, write idempotency, cost guardrails |
| Resilience | Single instances | Backups, restore runbook, horizontal scale, load test |
| UX polish | Functional | Onboarding, empty/error states, mobile, accessibility |

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
- Tasks: `Dockerfile` per service; Container Apps for all three; Azure Database for PostgreSQL and Azure Cache for Redis (private networking where possible); Azure Blob provisioned and `VOICE_AUDIO_PERSIST_ENABLED=true`; migrations run as a deploy step (forward-only, existing runner); secrets from Azure Key Vault, never baked into images; **worker `/internal/*` reachable only from the gateway (private ingress); only the BYO-LLM think path is public** (the split-ingress decision from the security review).
- Manual test: a staging deploy serves a full spoken call from a browser, both audio blobs are fetchable, `npm run smoke` reports Azure `OK`.

### Part 4.2 — CI/CD pipeline
- Goal: every change is built, checked and shipped the same way.
- Tasks: pipeline that runs typecheck, lint (Biome + Ruff), the test suite (4.3), and a migration dry-run on every PR; builds and scans images; deploys to staging on merge and to prod on a tag/approval; dependency pinning and an audit step (`npm audit`, `uv`/pip audit); rollback path documented.
- Manual test: a PR is blocked by a failing test; a merge deploys to staging automatically.

### Part 4.3 — Automated test suite
- Goal: behaviour is protected by fast tests, not just manual probes.
- Tasks: gateway unit/integration tests (auth guard, owner guard, session ownership, insights SQL scoping, cursor/range parsing, rate-limit wiring); worker tests (controller decisions, `TurnRunner` identity match and failure paths, Engram wrapper against a faked SDK, reframe fact-lock, rate-limit throttle); frontend tests for critical logic (nav config, session state, memory panel refetch-on-user-change); keep the probes as end-to-end smoke. Coverage gate in CI. No live vendors required for the unit layer.
- Manual test: `npm test` (new) and the worker test command both pass in CI; coverage meets the configured threshold.

### Part 4.4 — Member access control (waitlist)
- Goal: not every Google account gets in; access is deliberate (**D-A: waitlist**).
- Tasks: an `access_requests`/`members` model with states (requested → approved → active, plus revoked); a "request access" screen for a signed-in-but-unapproved account that captures the request without creating a private pool; an admin queue to approve/deny in batches; a gate in the auth callback that, for an unapproved account, records/refreshes the request and shows a clear "you're on the waitlist" state instead of provisioning a member. Roles beyond owner/member if needed (e.g. reviewer). All config-driven; owner set stays `OWNER_EMAILS`.
- Manual test: a new account lands on the waitlist and gets no user/pool row; the owner approves it; on next sign-in it becomes a member; a denied/revoked account is refused with a clear message.

### Part 4.5 — Quotas, idempotency & abuse controls
- Goal: one user (or a bug) cannot exhaust Engram/OpenAI/Deepgram spend or hammer the system.
- Tasks: per-user quotas (e.g. turns or minutes per day) enforced server-side with honest messaging when hit; write idempotency for turn persistence and write-back; finish the rate-limit story (per-user keys where a session is known, not only per-IP); cost guardrails/alerts on vendor usage. Thresholds are config.
- Manual test: a user over quota is refused honestly and the event is logged; a retried write does not double-record.

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

## 5. Suggested sequencing

Launch-blocking first: **4.1 → 4.3 → 4.4 → 4.7 → 4.6 → 4.2 → 4.5 → 4.8 → 4.9** (deploy, tests, access, privacy, monitoring, then the pipeline and the rest). Phase 5 begins once the invited beta is stable; Phase 6 is pulled by demand. Exact order is Tauqueer's call.
