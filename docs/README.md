# Docs map

Canonical index for this repository. Owner: Tauqueer.

Agents: read [AGENTS.md](../AGENTS.md) (how to work), then [CONTEXT.md](CONTEXT.md) (where we are), then the file that owns the work you were named. Humans can start here.

When you need **behaviour**, read the code. When you change **intent**, update the files that own that intent (see [WORKFLOW.md](WORKFLOW.md)).

---

## Read order (every sitting)

1. [AGENTS.md](../AGENTS.md) — owner, working loop, commit rules, how to start.
2. [CONTEXT.md](CONTEXT.md) — snapshot: what exists, what is current, what is parked.
3. [decisions/README.md](decisions/README.md) — why we chose what we chose. Do not re-litigate Accepted records.
4. The **named plan** (today: [PHASE_6_PLAN.md](PHASE_6_PLAN.md)).
5. [PRD.md](PRD.md) / [TRD.md](TRD.md) / [ENGRAM.md](ENGRAM.md) when the work touches product, architecture, or memory.

---

## What each file is for

Roles follow [Diátaxis](https://diataxis.fr): tutorials teach, how-to guides get a job done, reference is lookup, explanation is why. Decision records are a fifth kind — they are not rewritten when the world changes; a new record supersedes them.

| File | Role | Update it when |
| --- | --- | --- |
| [AGENTS.md](../AGENTS.md) | How-to (agents): loop, commits, commands | The loop or current-work pointer changes |
| [CONTEXT.md](CONTEXT.md) | Explanation: current snapshot | Product reality or current-work file changes |
| [WORKFLOW.md](WORKFLOW.md) | How-to: how we write and update docs | The docs process itself changes |
| [decisions/](decisions/README.md) | Decision log (one choice per file) | Tauqueer locks or replaces a decision |
| [PRD.md](PRD.md) | Explanation: what and for whom | Product scope or success criteria change |
| [TRD.md](TRD.md) | Reference: how it is built now | Transport, TTS, isolation, or data model change |
| [ENGRAM.md](ENGRAM.md) | Reference: memory contract | Isolation or Engram API mapping changes |
| [ENGRAM_MEMBER_PRIVATE_WORKAROUND.md](ENGRAM_MEMBER_PRIVATE_WORKAROUND.md) | Explanation: leak research | That incident’s facts change |
| [ENGRAM_MEMBER_AUTH_REPORT.md](ENGRAM_MEMBER_AUTH_REPORT.md) | Explanation: auth measurements | Re-measured |
| [ENGRAM_PRIVATE_ROLLOUT.md](ENGRAM_PRIVATE_ROLLOUT.md) | How-to: named plan | Tauqueer names a part from that file |
| [PHASE_PLAN.md](PHASE_PLAN.md) | Reference: current vs shipped vs later | The current-work file changes |
| [PHASE_6_PLAN.md](PHASE_6_PLAN.md) | How-to: **current named parts** | A part is added, split, or locked |
| [PHASE_5_PLAN.md](PHASE_5_PLAN.md) | How-to leftover: persona sittings in §4 | A leftover sitting passes or is dropped |
| [SHIPPED.md](SHIPPED.md) | Explanation: history. Not a build plan | A slice is live and measured |
| [FUTURE.md](FUTURE.md) | Reference: parked product and Plan X | Something is pulled forward or parked |
| [PRODUCTION_PLAN.md](PRODUCTION_PLAN.md) | Pointers only | Index files move |
| [COMPONENT_LIBRARY.md](../frontend/COMPONENT_LIBRARY.md) | Reference: which UI we may copy | A screen is about to copy a new file |

Do not put implementation in SHIPPED. Do not put parked work in the current plan. Do not mention phase/part numbers in commits, comments, or PR titles — those labels live only in the plan files Tauqueer uses to name work.

Existing files stay where they are. We do not split them into `tutorials/` / `how-to/` / `reference/` / `explanation/` folders; the table above is the map.

---

## Working loop (product)

Full text: [AGENTS.md](../AGENTS.md) §3 and [PHASE_6_PLAN.md](PHASE_6_PLAN.md). Short form:

one named part → its subparts in order → tests and logic check after **each** subpart → after the part, tell Tauqueer if a manual sitting is needed → one short commit (no phase/part numbers, no AI attribution) → stop until he names the next part.
