# Phase 5 — Personas

Current product work. Owner: Tauqueer. Read [AGENTS.md](../AGENTS.md), [PRD.md](PRD.md), [TRD.md](TRD.md), and [ENGRAM.md](ENGRAM.md) first. **Do only the part Tauqueer names.** Do not start [FUTURE.md](FUTURE.md). Do not start coding until he names a part after this architecture is locked.

Goal: several owner-created Engram personas. A member talks to **one sitting at a time**. Shared knowledge is per persona. Private memory is per (user, persona). Isolation is structural in Engram plus an explicit persona pin on every app session.

---

## 1. Locked with Tauqueer (7 Sep 2026)

### Product

1. **Owner-only create.** Members do not create or teach. User-shaped personas stay parked. If Engram `create` 403s, the owner may **link** an existing Engram persona id, then teach/publish locally.
2. **Every approved member sees every published persona** and may pick any. No talk until they pick. Empty state copy comes from config.
3. **Both gates.** Our published list is who may see it. On **first talk** we still `personas.subscribe`. If subscribe 403s (`org:manage`): log, continue if retrieve still works. If retrieve/chat 403 not-subscribed: fail closed. Isolation does not depend on subscribe succeeding.
4. **After sign-in: dashboard.** The **same picker** is on chat and on voice. Owner in the member app sees only published (drafts stay on `/admin/persona`).
5. **Quotas unchanged.** No per-persona cap. Existing member daily caps stay.
6. **Switching personas ends that sitting.** New Postgres session + new Engram `session_id`. Two browser tabs may hold two sittings (Ada and Nova) at once.
7. **Members only see published.** Unpublished = owner draft.
8. **Hide vs destroy.** Unpublish is local; pools stay; the **next** think on a live call 404s (current utterance may finish). Destroy is typed confirm + Engram `personas.delete` (wipes every member’s private pool for that persona) + delete our row.
9. **Subscribe on first talk**, not on waitlist admit, not to every published persona at once.

### Architecture

10. **Catalog vs engine.** Our `personas` table is the product catalog (handle, name, description, `voice_config`, published). Engram is the memory engine. Members never list Engram’s API.
11. **Pin, don’t guess.** Every session has `user_id` + `persona_id`. Chat, voice, history, memory, and lifecycle take that id. `resolveActivePersona` goes away. Missing or unpublished → same 404 as a missing session (no leak).
12. **Pools.** Owner teach/answer/shared ingest → `{org}:{persona}`. Member talk (`retrieve` + `converse`, or `chat`) → `{org}:{persona}:{user}`. Never ingest product chats into `{org}:{user}`. Never hand-build tenant strings.
13. **Sitting vs long-term memory.** Engram `session_id` is this sitting’s thread. Yesterday’s facts live in the private pool; a new sitting still retrieves them. Chat and voice for the same persona are **two Postgres sessions** (text vs voice) and **two Engram `session_id`s**; they still share the private pool. Do not share one Engram thread across mic and keyboard.
14. **TTS.** Deepgram voice id lives on that persona’s `voice_config`. `DEEPGRAM_TTS_VOICE` is fallback only if a row has none. Style rules in `voice_config` stay for the speaking LLM.
15. **`ENGRAM_PERSONA_ID`.** No longer chooses the active persona. Optional **seed** only when the local table is empty.
16. **History and memory.** Filter by the persona you are on. Never mix Ada and Nova in one transcript. Owner conversations list filters by persona the same way.
17. **Delete-my-data.** Forget + unsubscribe **every** persona that member used, not “the one active row.”
18. **Identity headers** already carry our persona UUID (`x-persona-id`). The think path must use the session’s persona, not “the only row.”

```
member (waitlist-approved)
  → published rows in OUR personas table
  → pick Ada (chat or voice — same picker)
  → Postgres session: user_id + persona_id + channel + Engram session_id
  → worker: claimed ids must match the row
  → EngramClient(org, this member)
       retrieve / converse / chat(Ada’s Engram id)
       private  {org}:{ada}:{alice}     never built by hand
       shared   {org}:{ada}             owner teach only
```

---

## 2. Ingest map (who writes where)

| Who | Action | Engram call | Pool |
| --- | --- | --- | --- |
| Owner | teach / question bank / document | `teach`, `answer`, `pool(pid,"shared").document` | **shared** `{org}:{persona}` |
| Owner | set spoken voice | local `personas.voice_config` (TTS id + style) | — |
| Member | talk (default brain) | `retrieve` then `converse` with `session_id` + `speaker` | **private** `{org}:{persona}:{user}` |
| Member | talk (`BRAIN_MODE=chat`) | `chat` (Engram writes both sides) | **private** |
| Member | first talk | `subscribe(pid, engram_user_id)` then the turn | grant only |
| Owner | unpublish | local `published=false` | pools unchanged; next think 404 |
| Owner | destroy | `personas.delete` after typed confirm | **shared + every private pool for that persona** |
| Member | delete account | forget + unsubscribe **each** persona used | that member’s private only |

Conversation is **never** promoted to shared. Teaching is **never** written from a member chat.

---

## 3. Parts (name one to start)

**Parts 5.1–5.3 are done. The voice picker is in the product. Part 5.5 is named and in progress** — do not mark it done until its manual tests pass. Do not start 5.6–5.7 until Tauqueer names one.

Engram **subscribers** are not a later part in this file. First-talk subscribe code is in. Filling Engram’s audience list needs a credential that can actually subscribe (`org:manage` on this alpha), or an add in their dashboard. See [ENGRAM.md](ENGRAM.md) §4.

### Part 5.1 — Stop assuming one persona (done)

- Goal: the backend can store and address many local personas without throwing.
- Tasks: replace `resolveActivePersona` with lookup by id; `published` on `personas` (existing rows published so today’s single persona still works); session create requires `persona_id`; chat/voice/memory/lifecycle 404 on missing or unpublished the same way as a missing session; `ENGRAM_PERSONA_ID` is seed-only when the table is empty, never the resolver. Config, no magic ids. Member directory read of published rows (API; picker UI is later parts).
- Manual test: two local rows do not 500/409 the app; unpublished id 404s; isolation probe still passes with one published persona. **Passed.**

### Part 5.2 — Owner: many personas (done)

- Goal: `/admin/persona` creates **or links**, lists, teaches, ingests, publishes, and sets voice on more than one persona.
- Tasks: try Engram `personas.create`; on 403, link an existing Engram persona id; local row + `voice_config` (including TTS voice id); teach/questions/shared ingest aimed at the selected persona; publish/unpublish; do not call Engram `delete` here.
- Manual test: owner creates or links a second persona, teaches a fact, publishes it, sets a TTS voice; members still cannot see the unpublished draft. **Passed.** Live create 403 → link; teach and shared ingest on the selected row; local publish. Engram subscribe still 403s `org:manage` with this key (record locally). Member talk pickers came in later parts, not a miss here.

### Part 5.3 — Subscribe on first talk (done)

- Goal: talking to a published persona grants Engram access without subscribing the world at admit time.
- Tasks: drop admit-time subscribe to `ENGRAM_PERSONA_ID` only; on first turn/call for (user, persona), `subscribe` then proceed; log 403 `org:manage` without failing the member if retrieve still works; if retrieve/chat 403 not-subscribed, fail closed. Mirror `subscriptions` when subscribe succeeds.
- Manual test: new member is not subscribed to every persona; first voice or chat turn to Ada records a subscribe attempt; a second persona first-talk does the same. **Passed.** Live `/voice` sitting: first talk to each published persona logged `subscribe_forbidden` (`403 org:manage`); retrieve still 200; spoken call still worked. Engram People → Subscribers stays 0 until a key (or dashboard session) can grant audience — that is not more code in this part.

### Part 5.4 — Voice picker

- Goal: on `/voice` the member must pick a published persona before talking; switching ends the call.
- Tasks: list published personas; start call with that `persona_id`; Deepgram Settings use that row’s TTS id (`voice_config`, env fallback); hang up to switch; two tabs allowed.
- Manual test: member A talks to Ada, hangs up, talks to Nova; each call’s transcript is only that persona; Ada’s shared fact is not Nova’s; Ada and Nova can sound different if their TTS ids differ. Picker and TTS-from-row are in the product; confirm hang-up → switch on a live call if that sitting is still open.

### Part 5.5 — Chat, history, memory follow the persona

- Goal: typed chat uses the **same picker**; history and memory never mix personas.
- Tasks: chat sitting pin; no talk until pick; history and memory filter by the persona you are on; owner conversation list filters by persona. New sitting = new Engram `session_id`; private-pool recall still works.
- Manual test: Ada chat does not list Nova turns; memory panel for Ada does not show Nova private hits; opening chat with no pick shows the empty state, not a guessed persona. **Code is in; do not mark done until the sitting below passes.**

### Part 5.6 — Isolation and delete-my-data for many personas

- Goal: two users × two personas cannot leak; account delete clears every private pool.
- Tasks: extend `npm run isolation`; lifecycle purge loops personas used, not one active row; quotas unchanged (per member).
- Manual test: user A cannot read user B’s Ada session; user A’s Ada memory is not in their Nova retrieve; delete-my-data unsubscribes both personas.

### Part 5.7 — Unpublish and destroy

- Goal: hide vs wipe are different, both owner-only, both confirmed.
- Tasks: unpublish hides from members, leaves Engram pools, next think 404s on a live call; destroy calls `personas.delete` after typed confirm and removes the local row. Copy from config. Never destroy from a member UI.
- Manual test: unpublish makes the persona disappear from the picker; republish restores chats still in Engram. Destroy of a throwaway persona makes retrieve/chat 404 and local history gone.

---

## 4. Done when (the phase)

A member picks Ada or Nova on chat and on voice, each remembers that member separately, the owner can teach and voice them separately, unpublished drafts stay owner-only, destroy is explicit, two tabs do not mix pools, and `npm run isolation` covers two users × two personas. Then stop. Onboarding UI and accounts are [FUTURE.md](FUTURE.md).
