# Engram member private memory — the leak was ours, and the fix already exists

Owner: Tauqueer. Status: **research redone 8 Sep 2026 — earlier conclusion withdrawn.** The workaround this file used to recommend is **not needed**. Engram already supports per-member private memory for a backend serving many end users; we were not using the credential model it is built on. Rollout: [ENGRAM_PRIVATE_ROLLOUT.md](ENGRAM_PRIVATE_ROLLOUT.md). Contract: [ENGRAM.md](ENGRAM.md) §2.3. Personas sittings: [PHASE_5_PLAN.md](PHASE_5_PLAN.md) §4.

**Do not implement** until Tauqueer names a phase and a part from the rollout plan.

---

## 1. What happened in the product

Two Cognora Google accounts talked to the **same published persona** on voice/chat:

- `getcognora@gmail.com` said something like "my name is Harish."
- Later `tauqueer655@gmail.com` heard the bot treat that name as known.

App-side isolation was fine: different `users` rows, different Engram member ids, different Postgres sittings, subscribe per member. In Engram's dashboard **People → Private**, both members' turns showed under **one** subscriber:

`8de1b2b278724e0bba19000086f8bef2` = org admin `mohammadtuti655@gmail.com` — the account that owns our `egm_` API key.

That part of the original diagnosis was correct: **all bot traffic landed in the API key owner's private pool.**

---

## 2. The root cause we published, and why it was wrong

The earlier version of this file, and [ENGRAM_PRIVATE_ROLLOUT.md](ENGRAM_PRIVATE_ROLLOUT.md), concluded:

> `chat` / `retrieve` / `converse` take no `user_id`, therefore a multi-tenant backend **cannot** aim them at a member's pool. Engram must add a subject parameter before per-member private memory is possible.

The first half is a fact. **The second half does not follow, and it is wrong.**

Engram never intended a subject parameter. It resolves the member from the **authenticated principal**, and it expects a backend serving many end users to hold **one credential per end user** — which it will issue to us on demand. Its docs say so directly:

> "The backend derives these pools from **authenticated identity** and enforces them structurally through the core's tenant isolation." — [concepts/persona-memory](https://engram-docs-alpha.netlify.app/concepts/persona-memory)

> "A caller carries one of two bearer tokens; **both resolve to the same principal.** **Session** — a short-lived token for a signed-in person… **API key** — a long-lived `egm_` credential for a program." — [authentication](https://engram-docs-alpha.netlify.app/authentication)

> "**A session token works anywhere an API key does.**" — [quickstart](https://engram-docs-alpha.netlify.app/quickstart)

> "**add** — Add a person to the org… If it is a brand-new user, **supply a password so the account can be created.**" — [sdk/members](https://engram-docs-alpha.netlify.app/sdk/members)

> `session = engram.auth.login("alice@acme.com", "correct-horse-battery")` … `token = session["token"]` — [sdk/auth](https://engram-docs-alpha.netlify.app/sdk/auth)

So the missing piece was never on Engram's side. **We create each member's Engram account with a password and then delete the password** — `worker/src/worker/engram/org_member.py:124` mints it, `:138` clears it — and then talk to every persona as the key owner. The leak is a credential-model bug in our worker, not a gap in Engram's API.

The earlier file also listed "Password / `auth.login` per member" as an explicit non-goal, and [ENGRAM.md](ENGRAM.md) §2.3 asserted that a discarded member password "cannot act as a member on `chat`/`retrieve`." That assertion was never measured. It is false.

---

## 3. What we measured (8 Sep 2026, live alpha, org `100912164da2419885314c9fdb5358b7`)

Throwaway persona, throwaway member created with a password we kept, both destroyed afterwards.

### 3.1 A member session token authenticates the persona conversation routes

`auth.login(email, password)` returns a JWT plus its tenant:

```json
{"token": "eyJhbGciOiJIUzI1NiJ9…", "token_type": "bearer", "expires_in": 43200,
 "user": {"id": "8f048d27df5d41e8b3f0b7f2c510194d", …}, "role": "member",
 "tenant": "100912164da2419885314c9fdb5358b7:8f048d27df5d41e8b3f0b7f2c510194d"}
```

Decoded claims carry `sub` / `user_id` = the member, `role: "member"`, `exp` = **12 hours** out.

Build a client on it — `EngramClient(org, member_id, api_key=token)` — and the conversation routes land where they should:

| Call as the member | `tenant` in the response |
| --- | --- |
| `personas.chat(pid, "…")` | `{org}:{persona}:8f048d27df5d41e8b3f0b7f2c510194d` |
| `personas.converse(pid, "…")` | `{org}:{persona}:8f048d27df5d41e8b3f0b7f2c510194d` |

`personas.retrieve(pid, "favourite colour")` as that member returned **both** pools, correctly labelled per row:

- `…:{persona}:8f048d27…` → `"Remember this: SESSIONPROBE-…-my-favourite-colour-is-vermilion"`
- `…:{persona}` → `"The probe persona … answers questions about colours."`

Semantic retrieve over the member's own private pool **works**. It was never broken; we were never the member.

### 3.2 Nothing landed in the admin pool

| Admin read | Result |
| --- | --- |
| `user_memories(pid, member)` | 4 rows — the marker, both persona replies, the converse turn |
| `user_memories(pid, admin)` | **`{"memories": []}`** |
| `personas.users(pid)` | `["8f048d27df5d41e8b3f0b7f2c510194d"]` — the member only |
| `conversations(pid, user_id=member)` | both threads, with turn counts |

### 3.3 A member token cannot overreach

| Attempt as the member | Result |
| --- | --- |
| `user_memories(pid, admin_id)` | `403 cannot access another user's private memory` |
| `private(pid, admin_id).text(…)` | `403 cannot access another user's private memory` |
| `scoped("{org}:{pid}:{member}").memory.list()` | `403 persona-private memory is not readable on the generic /t/{tenant} routes` |

Member permissions are exactly `["memory:read", "memory:write"]`. Defence in depth holds: even with a stolen member token, the blast radius is that one member's own pool.

### 3.4 The credential can only be set once — this is the real constraint

| Attempt (as org admin) | Result |
| --- | --- |
| `platform.set_password(member, new_pw)` | `403 missing permission(s): ['platform:admin']` |
| `members.add(same_email, password=new_pw)` | `409 user is already a member` — password unchanged |
| `auth.register(same_email, new_pw)` | `409 an account with this email already exists` |
| `auth.login(email, new_pw)` | `401 invalid email or password` |
| `auth.login(email, original_pw)` | still succeeds |
| `members.remove` then `members.add` with a new password | **same `user_id`**, private pool intact, **password still the original** |

Our org admin key holds `["billing:read","members:manage","members:read","memory:read","memory:write","metrics:read","org:manage","tokens:read"]`. It has **no** `platform:admin` and **no** `tokens:manage` (`tokens.create` → `403 missing permission(s): ['tokens:manage']`).

**Therefore: the password we set at `members.add` is the only credential we will ever have for that member.** Discard it and that member is unreachable for good — remove-and-re-add does not recover it, because the platform account outlives org membership.

### 3.5 What this means for the two accounts already on People

`getcognora@gmail.com` and `tauqueer655@gmail.com` were joined by `ensure_org_member`, which either succeeded with `password=""` (pre-existing Engram account) or retried with a random password it then cleared. Either way **we hold no credential for them and cannot mint one.** They have to be re-provisioned under an identity we control. Nothing is lost by that: their private pools are empty — every turn they ever took went to the admin's pool.

---

## 4. The fix

Per member, per persona turn:

1. **Provision once** — `members.add(email, role="member", password=<random>)`, and **keep** the password (encrypted at rest, never logged).
2. **Mint a session** — `auth.login(email, password)` → JWT, `expires_in` 43200s. Cache per member; refresh before expiry; re-login once on a `401`.
3. **Talk as the member** — `EngramClient(org, member_id, api_key=<session token>)` for `chat` / `converse` / `retrieve` **only**.
4. **Keep the org key for admin work** — `personas.create/teach/answer/pool(shared)`, `subscribe` / `unsubscribe`, `user_memories` / `forget_user_memory` on the delete-my-data path. A member token cannot do these and must not be asked to.
5. **Fail closed** — if login fails, fail the turn. Never fall back to the org key on a member path. That fallback *is* the leak.

What this buys over the withdrawn workaround: real semantic private retrieve, Engram-native compression and episodes, working `session_id` threads, `BRAIN_MODE=chat` becomes correct rather than forbidden, per-member rate-limit buckets instead of one shared one, and per-member usage metrics instead of everything billed to the admin.

Rollout is in [ENGRAM_PRIVATE_ROLLOUT.md](ENGRAM_PRIVATE_ROLLOUT.md).

---

## 5. Why not the old workaround #2

Kept here so nobody re-derives it. It was: write with `private(pid, user_id=member).text`, read with `user_memories`, filter `retrieve` to shared-only, ban `converse`/`chat` on member paths.

It works — those admin surfaces really do isolate — but it costs a semantic private retrieve, replaces conversation turns with flat ingest, adds an admin list call per turn, forbids `BRAIN_MODE=chat`, keeps every end user in one rate-limit bucket, and leaves all usage metered against the admin. It is a worse product built to route around a limit that is not there.

One correction to the old evidence, because it is going in a message to Engram: we reported that `retrieve` "does not see subject-ingest writes." It does. `retrieve` reads **the caller's** private pool, and the caller was the admin, so a write aimed at member A's pool was correctly invisible. The SDK says this outright — `personas.private` docstring: "Read it back with `retrieve`, which spans your private pool and the shared one." Do not send Engram the claim that their write path is unindexed.

---

## 6. What is still genuinely missing from Engram

Only one thing, and it is narrow:

**An org admin cannot obtain a credential for a member of their own org.** Password reset is `platform:admin` (superadmin), and `tokens.create` is org-scoped with no subject and needs `tokens:manage` we do not hold. So a backend must take custody of every member's password forever, and any member whose account it did not create is permanently unreachable.

The ask, in preference order:

1. **Org-admin-scoped session mint** — `POST /orgs/{org}/members/{user_id}/token` returning a short-lived session token for a member of that admin's own org. This removes password custody from integrators entirely and is the clean fix.
2. Failing that, **org-admin password reset** for a member of their own org (today `platform.set_password` needs `platform:admin`).
3. **Document the pattern.** [examples/support-copilot](https://engram-docs-alpha.netlify.app/examples/support-copilot) promises "per-member isolation, so one customer's conversation is invisible to another" while the sample program binds a single `ENGRAM_USER_ID`. Nothing on the site shows a server obtaining many member credentials. That gap is what cost us this incident.
4. **Doc bug:** [sdk/overview](https://engram-docs-alpha.netlify.app/sdk/overview) still shows `EngramClient(org_id, f"{persona_id}:{user_id}")` for persona-private addressing. [sdk/tenants](https://engram-docs-alpha.netlify.app/sdk/tenants) and `llms.txt` both say that is a guaranteed 403.

Not blockers. Item 1 is an improvement request; the product ships without it.

---

## 7. Defects on our side this exposed

These are ours, they are real today, and they are not fixed by switching credentials. Parts for each are in [ENGRAM_PRIVATE_ROLLOUT.md](ENGRAM_PRIVATE_ROLLOUT.md).

1. **The grounding path has no tenant filter; the display path does.** `worker/src/worker/turn/service.py:417-421` feeds every retrieve hit to the answer model. `:846` filters the memory panel with `is_own_private_pool`. The path that *speaks to the member* is the unfiltered one. That asymmetry is the mechanism by which "Harish" was spoken aloud.
2. **Leaked text was copied into our own Postgres and is re-served.** In retrieve mode `outcome.messages` *is* the retrieved memory text, and `insert_turn(..., messages=…)` (`turn/service.py:927`) plus `insert_memory_refs(...)` (`:936-941`) persist it. It comes back through session detail (`gateway/src/insights/queries.ts:580,589-595`) and through `/api/me/export` (`gateway/src/lifecycle/export.ts:97,140-144`). `wipeMemberRows` deletes by the *deleting* user's id, so member A's words inside member B's rows **survive A's delete-my-data**. An upstream leak became a first-party retention defect. Historical rows need purging, not just a forward fix.
3. **The filter does not defend against the key owner.** If the API key owner signs into Cognora, their `users.engram_user_id` becomes the admin People id, and `is_own_private_pool` returns true for the admin pool — which holds everyone's turns. The memory panel and export would render all members' conversations as that account's own.
4. **Probes write into the live persona's pool.** `worker/src/worker/engram/probe.py:44` chats to `ENGRAM_PERSONA_ID` (the real `7f5f6d3d…`), and `worker/src/worker/brain/probe.py:39` drives real turns through both brain modes. Those writes become grounding for real member turns.
5. **`_grant_tried` is never invalidated.** `turn/service.py:185`. After delete-my-data unsubscribes a member (`lifecycle/purge.py:96`), the cached pair suppresses re-subscribe until a worker restart.
6. **The client cache implies isolation it does not provide.** `registry.py` keys clients by member id, but every cached client carries the same key and therefore the same principal. Under the fix it becomes true; today it is decoration.
7. **The test asserted the wrong thing.** `worker/tests/test_engram.py:112-121` checks that a private tenant is *passed through*, never that it belongs to the caller. The gateway probe was fixed to assert the positive (`gateway/src/voice/isolationProbe.ts:443-459`) but it only guards the panel, not the turn.

---

## 8. Reproducing this

Both probes are throwaway-only: they create their own persona and member, and delete both in a `finally`. Neither touches a real persona or a real account.

- `session_probe.py` — provisions a member, logs in, talks as them, and asserts the pool ownership in §3.1–3.3.
- `session_probe2.py` — the credential-lifecycle matrix in §3.4.

They are not in the repo yet; a part in the rollout plan folds the first one into `worker/src/worker/engram/probe.py` so CI can assert member pool ownership on every run.

One question is still open because it needs a domain decision from Tauqueer: **can `members.add` take a service-controlled synthetic address** (e.g. `cognora-<app-user-id>@<a domain we own>`) instead of the member's Google address? Engram validated the address format — it rejected `@example.test` as reserved and accepted a `+tag` gmail alias — but we have not tested a domain we own. If it can, member provisioning never depends on an email whose account might already exist, and §6 item 1 stops mattering to us.

---

## 9. Out of scope here

- Implementing anything (wait for Tauqueer's go).
- One Engram org per Cognora user.
- Treating the Private-tab UI as an API.
- Migrating the admin pool's historical turns into member pools. They are mixed-owner by construction; they get deleted, not sorted.
