# PRD — Voice Persona Bot

Status: Locked for build. Owner: Tauqueer. Companion documents: [TRD](TRD.md), [Phase Plan](PHASE_PLAN.md).

---

## 1. Vision

A person opens the app in their browser, presses talk, and has a natural spoken conversation with a **persona** — a named character (for the first build, a well-known historical figure) that genuinely remembers them across turns and across sessions. The persona's knowledge and memory are powered by Engram; speech recognition, turn-taking, and speech synthesis are powered by Deepgram; a small reframing LLM turns the persona's recalled answer into fluent spoken language.

The product's reason to exist is **persona memory**: without Engram there is no product.

---

## 2. Goals

- Let a user hold a real-time, spoken conversation with a persona in the browser.
- Ground every reply in the persona's memory (shared knowledge + that user's private history) via Engram `personas.chat`.
- Keep each user's private history strictly isolated from every other user's.
- Persist a canonical record of every conversation (transcript, audio, metadata) independent of Engram.
- Support interruption (barge-in) so the user can talk over the bot naturally.

## 3. Non-goals (for the first build)

These were out of scope for the first build. **Most are now planned for the launch/growth phases** — see [PRODUCTION_PLAN.md](PRODUCTION_PLAN.md) (Phases 4–6) for how and when.

- Multi-persona management UI beyond a minimal admin screen for the single seeded persona. *(Planned: Phase 5.1.)*
- Telephony / WhatsApp / mobile-native channels. *(Candidate: Phase 6.4.)*
- Video, facial-emotion, or any non-text modality into Engram. *(Still out of scope.)*
- Billing/usage dashboards and cost optimization. *(Planned if we charge: Phase 5.5; cost guardrails and quotas: Phase 4.5.)*
- Voice cloning (groundwork only, in the hardening phase). *(Planned: Phase 6.2.)*
- Formal compliance / consent / delete-my-data flows (deferred until external users — **which is now**). *(Planned: Phase 4.7.)*
- Open self-serve signup. Launch is **waitlist-gated**: anyone can request access, the owner approves in batches (member access control: Phase 4.4).

---

## 4. Users & roles

- **End user (member):** talks to the persona in the browser. Signs in with Google. Maps to one Engram `user_id`; sees only their own private history plus the persona's shared knowledge.
- **Owner/admin (Tauqueer):** creates and teaches the persona, subscribes test users, reviews conversations. Uses the minimal admin screen and/or scripts.

For the first build there are ~2-3 test users, then the product is productionized for more.

---

## 5. Experience requirements

- **Channel:** browser microphone (WebRTC/MediaRecorder), audio played back in the browser.
- **Interaction:** full-duplex with **barge-in** — the user can interrupt while the bot is speaking and the bot stops.
- **Turn behavior:** the bot may speak, or deliberately stay silent/wait; the decision is model/signal driven, never keyword-based.
- **Latency:** the reply is streamed to the voice transport as it is composed, so speech starts on the first words rather than the last. Measured ~2.5-4s to the first spoken word; a brief "thinking" cue covers the wait. (The alternative brain, which asks Engram to compose the reply, costs ~12.5s and is kept only as a switch.)
- **Language:** English first (Deepgram Nova-3). Multilingual code-switching is a later phase.
- **Memory continuity:** the persona remembers earlier turns in the same call and prior conversations across restarts, because memory lives in Engram, not in the process.
- **Reply fidelity:** the reframing LLM speaks the persona's recalled answer in natural, spoken, first-person style; it must not invent facts beyond what Engram returned (minor connective phrasing only).

---

## 6. Representative user stories

- As a user, I press talk, say something, and hear the persona answer in a natural voice within a couple of seconds.
- As a user, I interrupt the persona mid-sentence and it stops and listens.
- As a returning user, I reference something I told the persona yesterday and it recalls it.
- As a user, I can never hear or reach another user's private conversation with the persona.
- As the owner, I can create the persona, teach it facts and documents, and subscribe test users.
- As the owner, I can review the full transcript and stored audio of any conversation.

---

## 7. Success criteria (first build "done")

The build is successful when, in the browser:

1. A signed-in user speaks and hears a persona reply grounded in Engram memory.
2. Memory persists across turns **and** across a process restart (proven live).
3. Barge-in works: talking over the bot stops its playback.
4. Every turn is written to the canonical store (Postgres) and both user and bot audio are stored in Azure Blob with URLs recorded.
5. Two different users cannot see each other's private history.
6. Turn-level timings are captured in logs.

---

## 8. Scope mapped to phases

See [Phase Plan](PHASE_PLAN.md) for the task-level breakdown.

- **Phase 0 — Setup (complete):** repo, dependencies, Docker services, environment, external-account smoke checks.
- **Phase 1 — Brain first (complete):** persona record + Engram wrapper + auth + reframe + controller + typed chat at `/chat`. Memory lives in Engram + Postgres and survives a process restart.
- **Phase 2 — Voice loop (complete):** browser audio + Deepgram Voice Agent API + BYO-LLM shim + barge-in + audio persistence. This is the end-to-end voice product. Latency reduction was folded in: the reply streams to the transport as it is composed, and the default brain reads Engram memory rather than waiting for Engram to compose. Plan and measured outcome: [PHASE_2_PLAN.md](PHASE_2_PLAN.md).
- **Phase 3 — Hardening (in progress):** failure handling, the read API, the personal and admin apps, observability, latency budgets, and the security review are in. Remaining: Azure deployment, multilingual, voice-clone groundwork. Blob audio archiving is built but switched off until there is a storage account. Isolation is enforced in the app (`sessions.user_id` + identity match); Engram subscription is not an access gate. A brand-new Google OAuth click-through still belongs to Tauqueer.

---

## 9. Assumptions & dependencies

- Deepgram **Voice Agent API** is the primary transport (single WebSocket: Nova-3 STT + Aura-2 TTS + turn-taking + barge-in) with a bring-your-own-LLM brain. The custom split pipeline was the documented fallback if the Voice Agent API could not host Engram-as-brain acceptably; it was **not needed** — the latency was resolved inside the brain instead.
- Engram is used on its **alpha** API; churn is acceptable, but the client is wrapped behind an interface.
- Accounts for Deepgram, Engram, OpenAI, Azure Blob, and Google OAuth are available.
- Persona content (which historical figure, its source material, the exact voice) is chosen by the owner and treated as content, not engineering.
