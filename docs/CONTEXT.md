# Context

Snapshot of this product as of 8 Sep 2026. Owner: Tauqueer.

This file answers “where are we?” It is not the architecture spec ([TRD.md](TRD.md)), not the memory contract ([ENGRAM.md](ENGRAM.md)), and not the build list ([PHASE_6_PLAN.md](PHASE_6_PLAN.md)). Behaviour: read the code.

---

## What this is

A browser voice bot that speaks as an owner-taught **persona** with long-term Engram memory. Members sign in with Google (waitlist). They pick a published persona, then talk at `/chat` or `/voice`. Private memory is per (member, persona). Shared knowledge is per persona.

Speech today: Deepgram Voice Agent (Nova-3 STT + Aura-2 TTS + barge-in) with our brain behind a BYO-LLM shim. **Current work** is a cloned Fish Audio voice **per persona** (hosted API only), then Home/picker cards and member UI. Locked why: [decisions/0002-hosted-fish-tts-per-persona.md](decisions/0002-hosted-fish-tts-per-persona.md).

---

## What already works

Typed chat, spoken Aura calls, personal `/dashboard`, owner `/admin` (create/link, teach, ingest, publish, destroy), waitlist, quotas, consent/export/delete, `/status`, isolation probes. Personas are built end to end. Engram-side per-member private memory works (8 Sep 2026): each member authenticates with their own session token; a member we cannot credential degrades to shared-only, never the key owner’s private pool.

History and measured latency: [SHIPPED.md](SHIPPED.md). Leftover live sittings from personas: [PHASE_5_PLAN.md](PHASE_5_PLAN.md) §4.

Deliberately off: blob audio archiving (`VOICE_AUDIO_PERSIST_ENABLED=false` until a storage account); `BRAIN_MODE=chat` (slow switch; default `retrieve`). Spoken calls need a live public worker URL (`BYO_LLM_PUBLIC_URL`).

---

## What we are doing now

[PHASE_6_PLAN.md](PHASE_6_PLAN.md). Tauqueer names **one part**. Do not start [FUTURE.md](FUTURE.md) or Azure deploy until he names them. Per-member Engram credential leftovers live in [ENGRAM_PRIVATE_ROLLOUT.md](ENGRAM_PRIVATE_ROLLOUT.md) — only if he names a part from that file.

Fish is **not** shipped. No GPU, no self-host. A Fish API key is not required to write tests; live Fish sittings need `FISH_API_KEY` in `.env`.

---

## Hard constraints (do not re-decide here)

- **Tauqueer names the part.** Never pick the next one. Never work two parts at once unless he says so.
- Config, not magic values. No keyword/intent heuristics for language understanding.
- Never hand-build Engram tenant strings. Text-only into Engram. Audio (including clone clips) never goes to Engram.
- TTS routing is a dedicated `voice_config` key from env, not id-format sniffing. Fish sitting + missing/401/402 → fail closed, no Aura fallback.
- Ground truth for behaviour is the code. Docs own **intent**.
- Context7 MCP for library/API lookups when connected; otherwise Engram / Deepgram / Fish published docs. This sitting: Context7 was not connected.

Full decision log: [decisions/README.md](decisions/README.md).

---

## Layout

| Path | Role |
| --- | --- |
| `frontend/` | React 18 + Vite + Tailwind. `/`, `/status`, `/waitlist`, `/dashboard`, `/chat`, `/voice`, `/admin` |
| `gateway/` | TypeScript: Google auth, chat HTTP, admin proxy, Deepgram (and later Fish) speech transport |
| `worker/` | Python (uv, CPython 3.12): Engram, reframe, controller, BYO-LLM, clone upload |
| `infra/` | Compose Postgres/Redis, migrations |
| `docs/` | This tree. Map: [README.md](README.md) |

Install and commands: [AGENTS.md](../AGENTS.md) §6.
