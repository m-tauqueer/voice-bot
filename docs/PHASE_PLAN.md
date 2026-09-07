# Phase plan (index)

Owner: Tauqueer. **He names a phase and a part. Do only that part.** Commit only when he says so, after the manual test passes. Do not mention phase/part numbers in commits.

| Now | File |
| --- | --- |
| How to work | [AGENTS.md](../AGENTS.md) |
| What / for whom | [PRD.md](PRD.md) |
| How it is built | [TRD.md](TRD.md) |
| Engram isolation & APIs | [ENGRAM.md](ENGRAM.md) |
| **Current work (personas)** | [PHASE_5_PLAN.md](PHASE_5_PLAN.md) |
| Already shipped | [SHIPPED.md](SHIPPED.md) |
| Later (Phase 6, parked, Plan X / Azure last) | [FUTURE.md](FUTURE.md) |

Phases 0–4 product work are done. **Phase 5 is built end to end** — many personas, owner catalog, pickers on chat and voice, per-persona history and memory, People-then-subscribe on first talk, unpublish with confirmation, and destroy. `npm test`, `npm run isolation` and `npm run security` are green. What remains is live sittings, plus one thing outside this repo: Engram's conversation endpoints take no subject, so per-member private memory is not real yet ([ENGRAM.md](ENGRAM.md) §2.3). Both lists are in [PHASE_5_PLAN.md](PHASE_5_PLAN.md) §4. Do not mark parts done until their sittings pass, and do not start FUTURE until Tauqueer names it.
