# Phase plan (index)

Owner: Tauqueer. **He names a phase and a part. Do only that part.** Commit only when he says so, after the manual test passes. Do not mention phase/part numbers in commits.

| Now | File |
| --- | --- |
| How to work | [AGENTS.md](../AGENTS.md) |
| What / for whom | [PRD.md](PRD.md) |
| How it is built | [TRD.md](TRD.md) |
| Engram isolation & APIs | [ENGRAM.md](ENGRAM.md) |
| Member-private leak research | [ENGRAM_MEMBER_PRIVATE_WORKAROUND.md](ENGRAM_MEMBER_PRIVATE_WORKAROUND.md) |
| **Per-member private memory rollout** | [ENGRAM_PRIVATE_ROLLOUT.md](ENGRAM_PRIVATE_ROLLOUT.md) |
| **Current work (personas)** | [PHASE_5_PLAN.md](PHASE_5_PLAN.md) |
| Already shipped | [SHIPPED.md](SHIPPED.md) |
| Later (Phase 6, parked, Plan X / Azure last) | [FUTURE.md](FUTURE.md) |

Phases 0–4 product work are done. **Phase 5 is built end to end** — many personas, owner catalog, pickers on chat and voice, per-persona history and memory, People-then-subscribe on first talk, unpublish with confirmation, and destroy. Automated checks including `npm run isolation`, `npm run security`, and `npm run failures` are green; a logic review found no product isolation gaps left in our code. What remains is the live sitting checklist in [PHASE_5_PLAN.md](PHASE_5_PLAN.md) §4, plus Engram’s missing conversation subject ([ENGRAM.md](ENGRAM.md) §2.3). The interim fix is planned in two phases in [ENGRAM_PRIVATE_ROLLOUT.md](ENGRAM_PRIVATE_ROLLOUT.md) — Tauqueer names a phase and a part from that file (or a Phase 5 sitting) to start. Do not mark Phase 5 parts done until their sittings pass, and do not start FUTURE until Tauqueer names it.
