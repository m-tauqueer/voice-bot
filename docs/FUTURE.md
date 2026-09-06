# Future work (parked)

Do **not** start anything in this file until Tauqueer names it. Current work is [PHASE_5_PLAN.md](PHASE_5_PLAN.md). History: [SHIPPED.md](SHIPPED.md).

---

## After Phase 5 — Phase 6: onboarding, UX, and accounts

Starts only when personas are done.

- **Onboarding & UX.** First-run/empty states; mic-permission coaching; error/loading surfaces; error boundary; mobile; accessibility (keyboard, focus, ARIA, contrast, reduced motion). Copy from config.
- **Accounts & preferences.** Display name/avatar; preferences (voice/language later); session management / sign-out everywhere. Extra auth providers stay optional (D-F).

---

## Parked product (later than Phase 6)

Leave these until Tauqueer pulls one forward:

- Scale & performance (load test, pools, worker concurrency, WebSocket scale, shedding)
- Billing (only if we charge — D-C)
- Growth loops (recaps, referrals, re-engagement)
- Multilingual code-switch (`language=multi`, config not a code branch)
- Voice cloning (voice already lives on `personas.voice_config`)
- Richer controller (safety, end-session, handoff, tools — still model/signal driven)
- More channels (telephony, WhatsApp, native mobile)
- Owner analytics (engagement, memory-growth, per-persona quality)
- User-shaped personas (members create/teach — isolation and moderation)

Feature/UX menu (candidates, not a promise): live captions; edit/forget a memory; push-to-talk; report a reply; recap email; PWA; i18n UI copy.

---

## Plan X — launch ops (last)

Order: **CI/CD → backups → security 2.0 → Azure deploy.** Azure is last of all — after product work and the rest of Plan X. Some checks only finish against real infra (live public-think, managed-Postgres restore, the pipeline deploy step).

### X.1 — CI/CD pipeline

Every change built, checked, shipped the same way. Typecheck, lint (Biome + Ruff), test suite, migration dry-run on every PR; image build/scan; staging on merge, prod on tag/approval; `npm audit` / uv audit; rollback path. Manual test: failing test blocks a PR; merge deploys to staging.

### X.2 — Backups & disaster recovery

Automated Postgres backups with a tested restore; Redis documented as ephemeral; Blob lifecycle; DR runbook (RPO/RTO, restore steps, contacts); secrets rotation. Manual test: restore drill on a throwaway environment, then a call works.

### X.3 — Security hardening 2.0

CSP, HSTS, X-Content-Type-Options, Referrer-Policy; dependency/image scanning in CI; secret rotation runbook; pen-test checklist; live public-think `401`; CORS/cookie for the production topology. Manual test: `npm run security` against staging.

### X.4 — Azure deployment (retire the tunnel)

Container Apps for gateway, worker, frontend; managed Postgres and Redis; Blob on (`VOICE_AUDIO_PERSIST_ENABLED=true`); migrations as a deploy step; Key Vault; worker `/internal/*` private; only the BYO-LLM think path public. Manual test: staging spoken call; blobs fetchable; `npm run smoke` Azure `OK`.
