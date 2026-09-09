# PRD — Voice Persona Bot

Status: Locked for build. Owner: Tauqueer. Map: [README.md](README.md). Snapshot: [CONTEXT.md](CONTEXT.md). Decisions: [decisions/README.md](decisions/README.md). Companions: [TRD](TRD.md), [ENGRAM](ENGRAM.md), [current work](PHASE_6_PLAN.md), [personas](PHASE_5_PLAN.md).

---

## 1. Vision

A person opens the app in their browser, picks a **persona**, presses talk, and has a natural spoken conversation with that named character — one that genuinely remembers them across turns and across sessions, separately from any other persona they also use. The persona's knowledge and memory are powered by Engram; speech recognition and turn-taking are powered by Deepgram; speech synthesis is Deepgram Aura unless that persona has a cloned Fish Audio voice; a small reframing LLM turns the persona's recalled answer into fluent spoken language.

The product's reason to exist is **persona memory**: without Engram there is no product.

---

## 2. Goals

- Let a user hold a real-time, spoken conversation with a persona in the browser.
- Ground every reply in the persona's memory (shared knowledge + that user's private history with **that** persona) via Engram.
- Keep each user's private history strictly isolated from every other user and from their own chats with a different persona.
- Persist a canonical record of every conversation (transcript, audio, metadata) independent of Engram.
- Support interruption (barge-in) so the user can talk over the bot naturally.

## 3. Non-goals (for the first build)

These were out of scope for the first build. **Cloned voices and member UI are current work** — [PHASE_6_PLAN.md](PHASE_6_PLAN.md). Personas (several, member picks) are built — leftover sittings in [PHASE_5_PLAN.md](PHASE_5_PLAN.md) §4. Launch ops and parked product live in [FUTURE.md](FUTURE.md).

- Multi-persona: several personas a member can pick, with memory and history per (user, persona). *(Built.)*
- Telephony / WhatsApp / mobile-native channels. *(Parked.)*
- Video, facial-emotion, or any non-text modality into Engram. *(Still out of scope.)*
- Billing/usage dashboards and cost optimization. *(Parked if we charge; cost guardrails and quotas: shipped.)*
- Voice cloning on a persona (hosted Fish Audio; Deepgram Aura otherwise). *(Current: [PHASE_6_PLAN.md](PHASE_6_PLAN.md).)*
- Formal compliance / consent / delete-my-data flows. *(Shipped.)*
- Open self-serve signup. Launch is **waitlist-gated**: anyone can request access, the owner approves in batches. *(Shipped.)*

---

## 4. Users & roles

- **End user (member):** talks to a published persona in the browser. Signs in with Google. Maps to one Engram `user_id`; sees only their own private history with that persona plus that persona's shared knowledge.
- **Owner/admin (Tauqueer):** creates and teaches personas, publishes them, reviews conversations. Uses the admin app.

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

See [PHASE_PLAN.md](PHASE_PLAN.md) for the index. Map: [README.md](README.md). History: [SHIPPED.md](SHIPPED.md). Current: [PHASE_6_PLAN.md](PHASE_6_PLAN.md). Personas: [PHASE_5_PLAN.md](PHASE_5_PLAN.md). Later: [FUTURE.md](FUTURE.md).

- **Phases 0–4 product (complete):** setup, typed chat, voice, hardening, waitlist, quotas, lifecycle, `/status`.
- **Personas (built):** several personas; member picks on voice and chat; memory per (user, persona).
- **Current:** cloned Fish voices per persona, then Home/picker UI, onboarding, mobile, accessibility, accounts.
- **After that:** parked product, then Plan X (Azure last).

---

## 9. Assumptions & dependencies

- Deepgram **Voice Agent API** is the transport for personas without a Fish voice id (single WebSocket: Nova-3 STT + Aura-2 TTS + turn-taking + barge-in) with a bring-your-own-LLM brain. Personas with a Fish voice id keep Deepgram for STT and use hosted Fish Audio for TTS (split pipeline). The brain stays behind the same interface.
- Engram is used on its **alpha** API; churn is acceptable, but the client is wrapped behind an interface.
- Accounts for Deepgram, Engram, OpenAI, Azure Blob, Google OAuth, and Fish Audio (when a persona uses a cloned voice) are available.
- Persona content (which historical figure, its source material, the exact voice) is chosen by the owner and treated as content, not engineering.
