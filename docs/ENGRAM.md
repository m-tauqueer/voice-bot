# Engram contract (this product)

How Engram actually works, read from the live alpha docs on 7 Sep 2026, then mapped onto this codebase. **This file is the Engram source of truth for agents.** Do not re-infer isolation from memory. When the live site disagrees with this file, update this file and the TRD together.

- Docs: <https://engram-docs-alpha.netlify.app/>
- Agent index: <https://engram-docs-alpha.netlify.app/llms.txt>
- API: `https://api-engram-alpha.getmetacognition.com`
- SDK: `pip install engram-ai-sdk` (import `engram_sdk`)
- Context7 MCP was not connected when this was written; every page below was fetched from the site.

Pages crawled (all 200 unless noted): home, quickstart, changelog, authentication, `llms.txt`; concepts: architecture, persona-memory, taxonomy, metrics; ingestion: overview, text, images, audio, video, documents, conversations, batch, consent, perception, structured; SDK: overview, tenants, personas, memory, conversation, sessions, threads, ingest, errors, collections, auth, tokens, account, admin, members, orgs, platform, billing, insights, audit, metrics, models; API: logs, metrics; examples: overview, knowledge-backfill, meeting-recorder, multimodal-agent, support-copilot, visual-journal; cookbooks: overview, agent-memory, conversation-memory, knowledge-base, set-up-team, rotate-keys, billing-limits, usage-dashboard.

404s that look like they should exist: `/sitemap.xml`, `/llms-full.txt`, `/concepts/isolation`, `/concepts/adr-003`. ADR-003 is linked from persona-memory to a private GitHub repo; the isolation design is restated on `/concepts/persona-memory`.

---

## 1. What Engram is (and is not)

Engram is a **memory database** behind a backend that does auth, tenant isolation, billing, and audit. Content is perceived, embedded, admitted or absorbed, and the graph reorganizes between writes. Retrieval is relevance-ranked, not a SQL filter.

It is **not** our app database. Postgres stays the canonical transcript. Redis stays ephemeral. Azure Blob stays audio (when on). Engram holds **what the persona knows** and **what this member told that persona**.

Three Engram objects that are easy to confuse, and that we must not mix:

| Name | What it is | This product |
| --- | --- | --- |
| `sessions.open/close` | Groups generic `memory.ingest` writes on `{org}` or `{org}:{user}` | **Do not use** for persona chat |
| Persona `session_id` | One conversation thread in `{org}:{persona}:{user}` | **This is our thread.** Carry it on every `chat` / `converse` / `retrieve` write-back |
| `threads.*` | Verbatim append-only log (core conversational mode) | **Do not use** |

`sessions.list()` after persona chats is empty, correctly. Reaching for it to find chats is the wrong object.

---

## 2. Tenants and pools

A tenant is the isolation boundary. Every memory lives under exactly one. The backend **derives** tenant strings server-side and hashes them to a collision-free 32-bit prefix. The engine cannot cross tenants.

### 2.1 Four addresses (docs disagree on how many; all four exist)

Taxonomy/auth pages still describe `{org}` and `{org}:{user}` plus isolation modes (`strict` / `org` / `global`). Persona pages add two more. **For this product we use the persona pair. We do not write conversation into `{org}:{user}`.**

| Tenant | Pool | What it holds | How we reach it |
| --- | --- | --- | --- |
| `{org}` | workspace | generic org memory | `EngramClient("org")` — we only use this for `insights.logs` |
| `{org}:{user}` | **user personal** | that member’s general memory, **not** a persona chat | `EngramClient(org, user)` then `ingest.*` — **do not put chats here** |
| `{org}:{persona}` | **persona shared** | what the owner taught this persona | `personas.teach` / `answer` / `pool(pid, "shared")` / `shared(pid)` |
| `{org}:{persona}:{user}` | **persona private** | one member’s conversations with **that** persona | **persona endpoints only** (`chat`, `converse`, `retrieve`, `private`) |

**Never build a tenant string with an f-string.** `scoped(f"{org}:{persona}:{user}")` is refused on generic `/t/{tenant}` routes **by design** (403). Those routes have no subscription check; serving them would let a member read another member’s chats by editing a URL.

Our worker already binds `EngramClient(org_id, engram_user_id)` and then calls `personas.*`. That is correct: the client identity is the member; the persona id is an argument, not a hand-built tenant.

### 2.2 Shared vs private (the product rule)

Two pools sit under one persona and **never mix**. Nothing from a conversation is promoted to shared.

- **Shared** = who the persona **is**. Owner teach / question bank / shared document ingest. Every subscriber of that persona reads it. Alice’s chat with Ada does not appear here.
- **Private** = what **this member** and **this persona** have said to each other. Only that member (and a workspace admin) reads it. Kwame talking to Ada cannot see Alice’s Ada chats. Alice talking to Nova cannot see her own Ada chats — different private tenant.

`personas.retrieve(pid, query)` fans out to **both** `{org}:P` and `{org}:P:U`, merges by rerank, dedupes on `gid` and text, **fails closed** if either sub-retrieve fails. That is why retrieve exists instead of `memory.retrieve` on the persona tenant (a single-tenant read would only see one pool).

Read `tenant` and `text` off **each result row**. The top-level `tenants` list only names the two pools searched. `zip(results, tenants)` mislabels every hit past the second.

Each pool numbers `gid`s from 1001 independently. `404 engine 404: gid 1023` means **wrong pool**, not deleted. `personas.node(pid, gid, scope="shared"|"private")` must name the pool.

### 2.3 What we never ingest where

| Intent | Call | Lands in |
| --- | --- | --- |
| Teach Ada a fact | `personas.teach(ada, text)` or `answer` | shared `{org}:ada` |
| Teach Ada from a document | `personas.pool(ada, "shared").document(...)` | shared |
| Member says something / persona replies (`retrieve` brain) | `personas.retrieve` then `personas.converse(..., session_id=, speaker=)` | private `{org}:ada:alice` |
| Member says something (`chat` brain switch) | `personas.chat(ada, msg, session_id=)` | private (Engram writes both sides) |
| Extra private media (receipt, note) | `personas.private(ada).text/image/...` | private |
| Generic `client.ingest.text` while bound as Alice | `{org}:alice` **personal** | **Not used for this product’s conversations** |

`converse` **does not reply**. Our default brain (`BRAIN_MODE=retrieve`) is retrieve + answer model + converse write-back. That is correct. Building a UI on converse alone would look like the persona is ignoring people.

`personas.private` returns an **ingest surface**, not a full client. There is no `memory.list` on the private tenant. Read private via `retrieve` or admin `user_memories`.

`personas.shared` / `pool(pid, "shared")` reach the same shared memories; `pool` goes through the persona endpoint and applies the **subscription check** even where generic tenant writes would be allowed. Our wrapper already uses `pool(..., "shared")` for document/text ingest. Keep that.

---

## 3. Conversation threads (`session_id`)

- Omit `session_id` on `chat` / `converse` → a **new** conversation every turn (amnesiac).
- Carry `reply.session_id` (or the id we claimed) for the whole app session with **that persona**.
- Our app claims the id (`uuid4().hex`) on first need so two in-flight turns share a thread. Engram treats it as an opaque caller-chosen key. `PersonaReply.session_id` is always populated (falls back to the id the SDK sent).
- Resume from Engram: `personas.conversations(pid)` newest first, then `conversation(pid, session_id)`. Unknown id → `NotFoundError`, not an empty transcript.
- `turn_count` is lifetime. Compressed segments come back as one `summary` turn, so `len(turns)` can be smaller.
- Switching personas **must** start a new app session and a new Engram `session_id`. One Engram thread is one member + one persona.

Compression (we do not have to call it): every `compress_every` turns (5 in persona private pools, 15 elsewhere) folds into an EPISODIC node; a worker narrates; then raw turns may be reclaimed. Hourly while the pool has traffic; once after ~24h silence. `purged: 0` usually means summaries are not written yet — an episode with no summary authorizes no deletion. Admin: `compress` / `compress_all` (the latter is on `llms.txt`, not on the personas SDK page).

---

## 4. Subscriptions vs isolation

These are different.

**Isolation** is structural (separate tenants). Subscribe cannot leak Alice’s private pool to Kwame. Unsubscribe does **not** delete the private pool.

**Subscription** is an **access grant** to use that persona (read shared + own private, chat). Docs:

> Chatting requires an active subscription — a member without one gets `ForbiddenError`.

> An unsubscribed member who attempts to use a persona receives a 403 Forbidden.

> `personas.unsubscribe(pid, user_id)` — their private pool is untouched.

Subscribe / unsubscribe / subscribers are **workspace-admin** on the docs. The public docs **never name** a permission string `org:manage`. Our live key has returned `403 missing permission(s): ['org:manage']` on `subscribe`, and independently `chat` / `retrieve` / `converse` still worked without a subscription. So:

1. **Published list in our app is who may see the persona.**
2. **On first talk** we still call `personas.subscribe(engram_persona_id, engram_user_id)` so a future Engram 403 cannot surprise us.
3. If subscribe 403s for missing manage scope: log it, do not block the member **while** retrieve/chat still succeed.
4. If retrieve/chat return `ForbiddenError` (not subscribed): fail the turn honestly. Isolation still holds. Owner needs a key that can subscribe.
5. **Never treat our `subscriptions` table as the isolation control.** It is a mirror for admin visibility.

`persona_subscriptions` on Engram’s side: `(id, org_id, persona_id, user_id, created_at)`, unique `(persona_id, user_id)`.

---

## 5. Create, update, delete

- `personas.create(name, handle=, description=, avatar_url=)` — workspace-admin. **Description is grounding, not decoration.**
- `update(..., status="active"|"archived")` — archive is the non-destructive hide.
- `delete(pid)` — **removes the shared pool and every subscriber’s private pool.** This is destroy, not unpublish.
- `list` / `get` — management.

For this product:

| Owner intent | App | Engram |
| --- | --- | --- |
| Draft / hide from members | local `published = false` | leave pools alone; optional `status=archived` |
| Stop one member using it | unpublished already covers all members; do not build per-member assign | optional `unsubscribe` (private pool remains) |
| Destroy the persona | delete local row after confirm | `personas.delete` — **all members lose that private history** |
| Member deletes their account | already: `user_memories` + `forget_user_memory` + `unsubscribe` | must run **for every persona they used**, not “the active one” |

Admin-only (member naming anyone else → `ForbiddenError: cannot access another user's private memory`): `users`, `user_memories`, `forget_user_memory`, `node(..., user_id=)`, `conversations(..., user_id=)`, `compress(..., user_id=)`, `private(pid, user_id=)`, `compress_all`.

`memory.forget` / `personas.forget` are **soft** (de-index). `collections.delete_row` is physical. Do not confuse them.

---

## 6. Auth, roles, scopes (what the docs actually say)

Roles: `member` | `org_admin` | `superadmin`. Permission shape is `resource:action`. Named scopes in the docs: `memory:read`, `memory:write`, `metrics:read`, `audit:read`. Empty scopes or `"*"` = full role of the creator. Scopes cannot exceed the creator.

`org:manage` is **not** in the public docs; it is what the live API returned on subscribe. Treat subscribe as workspace-admin / org-admin until a key with that scope exists.

Our product org is one Engram org. Each approved Google member maps to one Engram `user_id`. The **persona** is not a second Engram user.

Isolation modes (`strict` / `org` / `global`) apply to **generic** `{org}:{user}` tenants. Persona pools are a separate `authorize_persona_access` guard. We stay on persona endpoints and never depend on flipping `ISOLATION_MODE`.

Writes: never blind-retry on HTTP status. Reads may retry 429/502/503/504. Default SDK `max_retries=2`; our wrapper sets `max_retries=0` and retries reads itself. Keep that.

`gid=None` on ingest often means **absorbed** (success, merged), not failure. Media can also still be finishing. Audio conversation turns return 202 — memory is not there yet. We send **text only** into Engram (TRD); consent flags for audio/video/FER do not apply.

---

## 7. Call matrix we use

| Call | When | Writes | Reads |
| --- | --- | --- | --- |
| `retrieve(pid, query, top_k)` | default brain | — | shared + caller private |
| `converse(pid, text, session_id=, speaker=)` | write-back after retrieve reply | caller private | — |
| `chat(pid, message, session_id=)` | `BRAIN_MODE=chat` switch | caller private | shared + caller private |
| `teach` / `answer` / `questions` | owner admin | shared | — |
| `pool(pid, "shared").document/text` | owner ingest | shared | — |
| `subscribe` / `unsubscribe` | first talk / account delete | grant only | — |
| `user_memories` / `forget_user_memory` | member delete-my-data | forget private | one member’s private |
| `delete` | owner destroy | destroys shared + all private | — |
| `create` / `update` / `list` / `get` | owner admin | persona row | — |

`top_k`: at 10 retrieve answers were thin; **25** is what we measured. Keep it in config.

`PersonaReply.messages` is a list of 1–3 strings. SDK models page documents `reply.text`; our SDK 0.4.0 path treats `messages` as the source and flattens with `ENGRAM_MESSAGE_JOIN`. Trust the wrapper + a live probe, not the models page, if they disagree.

---

## 8. Failures that matter here

| What you see | Means | Do |
| --- | --- | --- |
| 401 | bad key | fix key; no retry |
| 402 | org over allowance | stop writes |
| 403 `ForbiddenError` on chat | not subscribed, or wrong pool | typed not-subscribed; do not invent a tenant |
| 403 `org:manage` on subscribe | key cannot admin-subscribe | log; isolation still app-side |
| 403 persona-private on `/t/` | someone built a three-segment tenant | use persona endpoints |
| 404 `engine 404: gid N` | wrong pool | pass `scope=` |
| 404 unknown `session_id` on `conversation()` | bad thread id | do not treat as empty chat |
| 422 | body failed contract | reason names the field |
| 5xx | engine/backend | retry reads only |
| `gid=None` | absorbed or media still running | usually ok |

Logs: `engram.insights.logs` is org-scoped, `audit:read`, **no memory text**. `result` is `ok` | `denied` | `error`.

---

## 9. What we deliberately do not use

- `{org}:{user}` personal pool for chats (Pattern A in their cookbooks — “tenant is the user”). That cannot share teach-knowledge across members without duplicating it.
- `memory.ingest` / `conversation.ingest` on the user client for product turns.
- Collections, threads, billing subscribe, platform superadmin, metrics dashboards.
- Audio/video/FER into Engram.
- Hand-built tenants, including the `/sdk/overview` example `EngramClient(org, f"{persona}:{user}")` — tenants page says that is 403 on generic routes.

Support-copilot’s **main** example uses one `ENGRAM_USER_ID` and `memory.retrieve` with no persona — that is **not** isolation. Their persona sidebar is the model we follow.

---

## 10. Doc contradictions (do not paper over)

1. Taxonomy = two tenant shapes; persona pages = four. We implement four and only write the persona pair.
2. Concepts: subscribers may teach shared. SDK: `teach` is workspace-admin only. We keep teach owner-only.
3. Isolation unknown flag: taxonomy says fallback `strict`; admin `set_flag` rejects unknown.
4. Two “subscriptions”: persona access vs billing plan.
5. Two `session_id`s: `sessions.open` vs persona conversation.
6. `org:manage` live vs undocumented in public docs.
7. Subscribe required for chat (docs) vs our alpha key still serving chat without subscribe (measured). Product policy: subscribe on first talk; app published list is the member-facing gate; fail closed if Engram starts enforcing 403.

---

## 11. Our wrapper today

`worker/src/worker/engram/engram_brain.py` already exposes create/get/delete, teach/answer/questions, shared ingest via `pool`, subscribe/unsubscribe, chat, retrieve (tenant off each row), converse. Client factory is `EngramClient(org, user_id)` with `max_retries=0`. That surface is enough for multi-persona **if** the gateway stops assuming there is one local row.

The owner catalog on `/admin/persona` can create or link more than one persona, teach and ingest the selected row, set TTS on `voice_config`, and publish or unpublish locally (Engram `delete` is a later destroy step). The gateway does not guess one local row.

The remaining gap is **member picker and first-talk subscribe**: members still need a picker on chat and voice; admit still subscribes `ENGRAM_PERSONA_ID` only. Locked product shape: [PHASE_5_PLAN.md](PHASE_5_PLAN.md).
