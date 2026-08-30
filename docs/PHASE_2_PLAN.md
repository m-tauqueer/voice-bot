# Phase 2 build plan — Voice loop (Deepgram Voice Agent)

Detailed, implementation-level plan for Phase 2. Owner: Tauqueer. Read [AGENTS.md](../AGENTS.md), [PRD.md](PRD.md), and [TRD.md](TRD.md) first. This document expands [PHASE_PLAN.md](PHASE_PLAN.md) parts 2.1–2.9 so an implementer does not invent APIs or skip the brain that already works.

> Phase 2 goal: a signed-in user talks in the browser, hears the same persona, can interrupt it, and every turn plus both audio sides is stored. English only. The brain is unchanged: controller → Engram `personas.chat` → reframe.

**Status: not started.** Tauqueer names one part at a time. Do not implement a later part while doing an earlier one.

Context7 MCP is the first stop for Deepgram / OpenAI protocol lookups. If it is not connected, use [Deepgram Voice Agent docs](https://developers.deepgram.com/docs/voice-agent) (message flow, Settings, LLM models) and say so. The protocol can churn — re-read those pages at the start of the part that sends `Settings` or speaks Chat Completions; do not treat example JSON in this file as a frozen schema.

---

## 0. How to use this document

- Build **one part at a time**, only when Tauqueer names it. Each part has: **Goal**, **Files**, **Logic**, **Config**, **Errors**, **Manual test**, **Done when**.
- **Do not mention phase numbers or part numbers** in commit messages, code comments, or PR titles.
- **Ground truth for current behavior is the code.** This file is intent + the locked wiring. Where Deepgram's live docs disagree with an example here, the live docs win and this file is updated.
- **Hard rules ([AGENTS.md](../AGENTS.md) §7):** no hardcoded product values; no keyword/intent matching; no "TODO later" holes in a finished part. Speak/silence stays on `TurnRunner` / the controller. STT text is a payload field, not something we parse for meaning.

---

## 1. What already exists (Phase 1 — do not rebuild)

| Area | Where | State |
| --- | --- | --- |
| Google auth + `/api/me` | `gateway/src/routes/auth.ts` | Cookie session in Redis. Optional `next` (origin-checked) on sign-in/out. |
| Typed chat | `POST/GET /api/chat`, `frontend/src/app/chat/ChatPage.tsx` | Auth-gated `/chat`. App `session_id` in `localStorage` per user. |
| Active persona | `gateway/src/personas.ts`, `personas` table | Handle, display name, `voice_config`. |
| Brain turn | `worker/src/worker/turn/service.py` `TurnRunner` | Pre-check → `chat` → `decide` → reframe → persist `sessions` / `turns` / `memory_refs` / `latency_spans`. |
| Internal turn HTTP | `POST /internal/turn` | Guarded by `INTERNAL_API_SECRET` / `INTERNAL_SECRET_HEADER`. |
| Session channel constants | `gateway/src/schema.ts` | `SESSION_CHANNEL.TEXT` and already `VOICE`. Worker `schema.py` only has text today — add voice when a voice session is inserted. |
| Gateway WS plugin | `gateway/src/index.ts` | `@fastify/websocket` registered; **no voice route yet**. |
| Deepgram config (optional) | `.env.example`, `gateway/src/config.ts`, `gateway/src/smoke.ts` | Zod schema has `DEEPGRAM_API_KEY`, `DEEPGRAM_STT_MODEL`, `DEEPGRAM_STT_LANGUAGE`, `DEEPGRAM_TTS_VOICE`. `DEEPGRAM_API_BASE_URL` is only read by `smoke.ts` (not the schema) — add it to the schema in the part that dials Deepgram. Smoke `SKIP` until the key is set. |
| BYO public URL | `BYO_LLM_PUBLIC_URL` | Optional on the gateway today. Deepgram must call this URL. |
| Azure Blob client | `gateway/src/clients.ts` | Constructed; unused until audio persistence. |
| Audio table | `audio_assets` | Exists, empty. |

Do **not** replace `TurnRunner` with a second brain. Voice is a new transport into the same runner.

---

## 2. Verified Deepgram Voice Agent surface (as of this writing)

Authoritative pages (re-read when implementing):

- Message flow: <https://developers.deepgram.com/docs/voice-agent-message-flow>
- Settings: <https://developers.deepgram.com/docs/configure-voice-agent>
- BYO / think endpoint: <https://developers.deepgram.com/docs/voice-agent-llm-models>
- Protocol reference: <https://developers.deepgram.com/reference/voice-agent/voice-agent>

**Connection**

- WebSocket: `{DEEPGRAM_AGENT_WSS_URL}` (new config; current host/path is `wss://agent.deepgram.com/v1/agent/converse`).
- Auth header: use the scheme the current reference documents (Deepgram Token auth). Header name and prefix come from config, not a string baked into logic.

**Required sequence**

1. Open WSS. Wait for `{ type: "Welcome", request_id }`. Send nothing before that.
2. Send `{ type: "Settings", audio, agent }`. Send no audio before `{ type: "SettingsApplied" }`.
3. Stream binary PCM. Handle server events listed below.

**Settings we must send (values from config)**

- `audio.input` / `audio.output`: encoding + sample rate + output container (docs default `linear16`, input 16000, output 24000, container `none`).
- `agent.listen.provider`: Deepgram STT. TRD locks **Nova-3** and **English** (`DEEPGRAM_STT_MODEL`, `DEEPGRAM_STT_LANGUAGE`).
- `agent.think.provider.type`: `open_ai` (BYO-compatible). `model` is whatever string Deepgram requires on the request (config); **our** model is still `OPENAI_MODEL` on the reframe client.
- `agent.think.endpoint`: `{ url: BYO_LLM_PUBLIC_URL + configured path, headers: gateway-minted auth + identity }`. See [LLM Models](https://developers.deepgram.com/docs/voice-agent-llm-models): any OpenAI Chat Completions-compatible URL works.
- `agent.speak.provider`: Deepgram TTS. TRD locks the **Aura-2** family. Docs: Aura uses `provider.version` `v1` and a model id such as `aura-2-…`; Flux (`v2`) is Deepgram's newer default if `speak` is omitted — **do not omit `speak`**. Model id = `DEEPGRAM_TTS_VOICE`. If the configured id is rejected by live Deepgram, stop and ask Tauqueer; do not silently switch families.

**Events the bridge must handle** (names from the message-flow doc)

| Event | What we do |
| --- | --- |
| `UserStartedSpeaking` | Barge-in: stop browser playback immediately (part 2.5). |
| `ConversationText` | Forward transcript to the UI when the voice UI exists. Not a controller input. |
| `AgentThinking` | Thinking-cue hook (part 2.6). |
| Binary audio | Relay to the browser for playback. |
| `AgentAudioDone` | Playback complete signal. |
| `Error` / `Warning` | Log; `Error` ends the session honestly (TRD: Deepgram down = session ends + reconnect attempt). |

**Do not** send Deepgram a personality `agent.think.prompt` that re-implements the persona. The persona is Engram + reframe. A prompt, if required by the API, is a config string (passthrough / empty default), never invented copy in code.

**Do not** set `agent.greeting` unless Tauqueer puts one in config. Default is omit/empty — Deepgram must not speak a hardcoded hello.

---

## 3. Phase 2 data flow

```
browser mic
  -> gateway client WebSocket (cookie auth)
  -> gateway opens Deepgram Voice Agent WSS
       Settings.think.endpoint = BYO_LLM_PUBLIC_URL + Chat Completions path
       headers = INTERNAL_API_SECRET + server-resolved session/user/persona ids
  -> Deepgram STT (Nova-3 en)
  -> Deepgram POST OpenAI Chat Completions -> worker BYO-LLM
        worker: last user-role message text -> TurnRunner (same as typed chat)
  -> Deepgram TTS (Aura-2 from config)
  -> gateway relays audio + events to the browser
```

Identity never comes from the Chat Completions `messages` body. Deepgram is a transport. The gateway already knows the user from the cookie when it opens the Voice Agent socket.

Persistence: `TurnRunner` still writes turns / memory_refs / brain+reframe spans. The gateway writes audio URLs (and later STT/TTS timing) on the same session/turns. Redis stays ephemeral (call state, barge-in flags), never conversational memory.

---

## 4. Locked decisions (Phase 2)

Settled from the TRD and the Phase 1 code. Do not silently change them.

- **D5 — Same brain.** Voice turns call `TurnRunner.run(...)`. No second controller, no second Engram path, no Deepgram-managed LLM.
- **D6 — BYO-LLM is OpenAI Chat Completions on the worker.** Path and header names are config. Deepgram `think.endpoint.url` is `BYO_LLM_PUBLIC_URL` plus that path. Locally that URL is a tunnel to the worker; in Azure it is the public worker.
- **D7 — Identity is gateway-minted headers.** When the user starts a call, the gateway creates (or resumes) a **voice** app session, then puts `INTERNAL_SECRET_HEADER` + configured id headers (app user, Engram user, persona, app session) on `think.endpoint.headers`. The worker rejects the request without a valid secret and a session row that matches those ids. Clients cannot supply another user's ids.
- **D8 — New app session per voice call**, `sessions.channel = voice` (constant in schema modules). Typed `/chat` sessions stay `text`. Do not reuse a typed-chat `session_id` for voice unless Tauqueer later says so. One Engram `session_id` per app session, same as text (already in `TurnRunner`).
- **D9 — App session exists before the first spoken turn.** Insert the `sessions` row when the Voice Agent socket is established (call start). The Engram `session_id` is written on the first successful `chat`, as today. Do **not** invent a warmup utterance to "open" Engram.
- **D10 — Inbound text for the runner** is the last Chat Completions message whose `role` is the protocol user role (structured field). Empty / missing → existing controller empty-input path. Do not scan message text.
- **D11 — Silence.** If `TurnRunner` returns a null `reply_text`, the Chat Completions response has empty assistant content. Deepgram must not speak a fabricated line. Do not substitute a canned phrase.
- **D12 — Fallback split pipeline is not in scope** unless Tauqueer trips it after Voice Agent cannot host Engram latency. Parts 2.1–2.9 assume Voice Agent.

---

## 5. Ask Tauqueer before guessing

Stop if any of these is still unset when the named part needs it:

1. **`BYO_LLM_PUBLIC_URL`** — the exact tunnel or public URL Deepgram will POST to (and that it stays up for the manual test).
2. **`DEEPGRAM_TTS_VOICE`** — the live Aura-2 model id Deepgram accepts today (TRD family is locked; the string must match Deepgram's current catalog).
3. **Spoken greeting** — omit (default) vs an owner-supplied config string. No greeting in code.

---

## Part 2.1 — BYO-LLM shim endpoint

**Goal.** Deepgram (or a probe that speaks the same protocol) can POST an OpenAI Chat Completions body and get back the reframed persona reply for a known user/session.

**Files.**

- `worker/src/worker/api/chat_completions.py` (name as you like; one module) — `POST` `{BYO_LLM_CHAT_COMPLETIONS_PATH}` (config, e.g. `/v1/chat/completions`). Register on the FastAPI app.
- Reuse `TurnRunner`. Reuse `require_internal_secret`.
- `worker/src/worker/turn/openai_messages.py` — extract the last user-role message text from a Chat Completions `messages` array (schema walk only).
- Probe: `python -m worker.byo.probe` (or extend the existing turn probe) that POSTs a canned body with the internal secret + id headers and asserts a Chat Completions-shaped response.

**Logic.**

1. Require internal secret (`require_internal_secret`).
2. Read id headers (names from config): app user, Engram user, persona, app session. Do **not** re-implement ownership checks — `TurnRunner.run` already raises `TurnError` for `session_not_found` (404), `session_ended` (409), `session_mismatch` / `persona_mismatch` / `identity_mismatch` (403). The shim just forwards the ids.
3. Parse the OpenAI request body (messages required). Inbound text = last user-role message (structured walk).
4. `TurnRunner.run(app_user_id, engram_user_id, persona_id, session_id, text)` — identical call to `/internal/turn`.
5. Return a Chat Completions object: `choices[0].message.role = assistant`, `content = reply_text or ""`. `id` / `created` / `model` from config or a generated id — no persona copy baked in.
6. On `TurnError`, map to HTTP exactly as `worker/src/worker/api/turn.py` does (reuse the `_raise_turn` mapping; do not duplicate the status table). Do not invent a reply.

**Config.** Present: `INTERNAL_API_SECRET`, `INTERNAL_SECRET_HEADER`, `WORKER_URL`. New: `BYO_LLM_CHAT_COMPLETIONS_PATH`, header names for app user / Engram user / persona / session. `BYO_LLM_PUBLIC_URL` is used by the **gateway** in 2.2; the worker only binds `WORKER_HOST`/`WORKER_PORT`.

**Streaming.** Check when building whether Deepgram sends `stream: true` and expects an SSE Chat Completions stream vs a single JSON body. Engram latency is high (15–70s), so if Deepgram enforces a first-token/response deadline, this is where the Voice Agent path could fail and the fallback (D12) is reconsidered. Support whatever the live protocol requires; do not assume non-streaming.

**Errors.** 401 missing/invalid secret. Honest Engram/reframe failures. Writes not blind-retried.

**Manual test.** A simulated Chat Completions request for a subscribed user and an existing (or just-created) session returns a fact-locked reframed reply; Postgres shows the new turns. Unauthenticated request is 401.

**Done when.** The shim is the only Deepgram-facing LLM URL, it is the same brain as typed chat, and the probe passes.

---

## Part 2.2 — Gateway ↔ Deepgram Voice Agent bridge

**Goal.** The gateway can open a Voice Agent session, apply Settings (including BYO-LLM), and stay up through `SettingsApplied`.

**Files.**

- `gateway/src/deepgram/agent.ts` — WSS client: connect, wait `Welcome`, send `Settings`, wait `SettingsApplied`, dispatch events, send binary, close.
- `gateway/src/routes/voice.ts` — authenticated client WebSocket (path from config). On connect: resolve user + persona, insert voice `sessions` row, mint think-endpoint headers, open Deepgram, relay.
- Voice session insert (gateway or worker). Worker `schema.py` gains the voice channel constant when the worker writes voice rows; gateway already has `SESSION_CHANNEL.VOICE`.
- Redis keys for the live call (prefix + TTL from config): Deepgram request id, app session id, barge-in flag (used in 2.5). Not transcripts.

**Logic.**

- Client socket is cookie-authenticated (same guard as `/api/*`). No identity in client messages.
- `Settings` is built only from config + `BYO_LLM_PUBLIC_URL` + minted headers. `think.endpoint.url` must be the public URL, not `WORKER_URL`.
- Do not stream client audio until `SettingsApplied` (2.3 will send it). This part can prove the handshake with a fixture or by connecting and waiting for `SettingsApplied`.
- `Error` → close both sockets honestly. `Warning` → log.

**Config.** Present Deepgram + `BYO_LLM_PUBLIC_URL`. New: `DEEPGRAM_AGENT_WSS_URL`, audio encoding/sample-rate/container, listen/speak provider fields that are not already present, Voice Agent auth header scheme, client WS path, Redis voice-key prefix/TTL. Deepgram key becomes **required to boot the voice route** (fail clearly if unset), not necessarily to boot the whole gateway until Tauqueer wants that.

**Errors.** Missing `BYO_LLM_PUBLIC_URL` or Deepgram key → do not open a call. Handshake timeout from config.

**Manual test.** Open the client WS (or a small script); gateway reaches `SettingsApplied`. A scripted audio clip or `InjectUserMessage` (if used in the test harness only) produces spoken output through Deepgram using the BYO endpoint. Document the tunnel command Tauqueer actually ran.

**Done when.** Handshake is reliable, Settings are fully config-driven, identity headers are on the think endpoint, and a scripted clip comes back as audio.

---

## Part 2.3 — Browser audio capture & playback

**Goal.** Mic in, agent audio out, in the browser.

**Files.**

- Frontend voice audio module (under `frontend/src`, library primitives only; **no new CSS files**). `getUserMedia` → PCM at the configured input rate/encoding → binary frames on the gateway WS. Playback of binary frames from the gateway at the configured output rate.
- Wire it to the voice route (or a thin `/voice` screen if 2.4 is not named yet — only if Tauqueer says this part includes a minimal page; otherwise a hook the next part mounts). If the part as named includes "speak into the mic and hear the persona," ship a minimal signed-in page that can do that, still on component-library primitives.

**Logic.**

- Permission denial is an honest UI error, not a retry loop.
- Capture/playback clocks and frame sizes come from config / the same Settings audio block. No magic sample rates in code.
- Credentials: WS upgrade must carry the session cookie (same origin or configured gateway origin).

**Config.** Frontend: `VITE_GATEWAY_URL` (present). Any public audio params the browser needs are `VITE_*` mirrors of the gateway Settings (added in this part, not hardcoded).

**Errors.** Mic blocked, WS drop → visible state, session ends cleanly.

**Manual test.** Signed-in user speaks and hears the persona. Same brain as `/chat` (a unique fact said in this call is recalled later in the call).

**Done when.** Capture, relay, and playback work end-to-end with device-permission handling.

---

## Part 2.4 — Voice UI components

**Goal.** The voice experience on the existing design tokens.

**Files.**

- Voice screen on the component library (`Card`, `Button`, `Badge`, `Grainient`, etc.). Route from config/`ROUTES` (e.g. `/voice` — add the constant; do not hardcode path strings in multiple places).
- Mic control + states driven by **bridge events** (idle, listening, thinking, speaking, error) — not by inspecting transcript wording.
- Live transcript from `ConversationText` (role/speaker field from the event, not keyword detection).
- Waveform/VU from input level (numeric samples), not from text.

**Logic.** Sign-in gate like `/chat`. Optional link from `/chat` for owners/testers. No client-side persona logic. No new CSS imports (same rule as admin/chat).

**Config.** Route constant + existing `VITE_*`.

**Manual test.** During a live call the UI tracks listening / thinking / speaking from real events.

**Done when.** The screen is the way a user starts and watches a call, and states match the bridge.

---

## Part 2.5 — Barge-in

**Goal.** Talking over the bot stops playback immediately.

**Files.** Gateway event handler + frontend playback buffer. On `UserStartedSpeaking`: stop playback and drop queued agent audio (flush). Redis/in-memory flag is ephemeral only.

**Logic.** Do not wait for `AgentAudioDone`. Do not parse transcript to decide interrupt. The Deepgram event is the signal (TRD §1.4, §8).

**Config.** None linguistic. Optional flush/timeout values from config if needed.

**Manual test.** Talk over a mid-reply; playback stops; the new turn is heard.

**Live test.** Not run. Tauqueer was in a noisy environment, so interrupt was not confirmed on a real call. Needs a quiet-room pass: talk over a mid-reply, playback cuts, the new turn is heard.

**Done when.** The flush/drop path is in and driven only by `UserStartedSpeaking` / `AgentAudioDone`. Live reliability is still unverified.

---

## Part 2.6 — Thinking cue & latency capture

**Goal.** Mask Engram latency and record per-stage spans.

**Files.**

- Short thinking cue (audio and/or UI) triggered by `AgentThinking` / the start of the BYO request — config asset or config-selected existing sound, not a hardcoded phrase in code.
- Latency: extend `latency_spans` writes. Worker already stores `brain_ms`, `reframe_ms`, `total_ms`. Gateway/worker add `stt_ms` and `tts_first_byte_ms` from Voice Agent / `Latency` events when those events carry timings (see current Deepgram event list). Do not invent numbers.

**Logic.** Cue must not break barge-in (stop cue on `UserStartedSpeaking` too). Session row still created at call start (D9).

**Config.** Cue enable flag, cue URI/duration, any mapping of Deepgram latency fields — all config.

**Manual test.** Spans recorded per turn; cue plays; interrupting during the cue still works.

**Done when.** Timings are queryable and the cue is safe with barge-in.

---

## Part 2.7 — Audio persistence to Azure Blob

**Goal.** Store both sides' audio and link them to turns.

**Files.** Gateway capture of user PCM and agent PCM per turn; upload via the existing blob client; insert `audio_assets` (`direction` from `AUDIO_DIRECTION`, URL, duration, format, size).

**Logic.** Buffer boundaries follow Deepgram turn events (user utterance vs agent audio), not text matching. Failures are honest (log + surface); do not retry writes blindly. Secrets stay server-side.

**Config.** Present Azure keys + container. New: content type, blob key prefix, optional max bytes.

**Manual test.** After a call, both user and bot blobs are fetchable from the stored URLs.

**Done when.** Both directions exist for a real turn and the rows point at them.

---

## Part 2.8 — Canonical logging for voice turns

**Goal.** A voice conversation is fully reconstructable from Postgres.

**Files.** Fill `turns.stt_meta` / `tts_meta` and any remaining controller/Engram fields the text path already writes. Structured logs per turn (session id, ordinal, action, reasons, Engram session id, span ids). No secrets.

**Logic.** Same isolation: queries always scoped by `sessions.user_id`. Voice and text turns share the `turns` table; channel is on `sessions`.

**Config.** Log field allow-list / level already via `LOG_LEVEL`.

**Manual test.** One voice call → ordered `turns`, `memory_refs`, `latency_spans`, `audio_assets`, stable `engram_session_id`.

**Done when.** You can reconstruct the call from SQL without the process still running.

---

## Part 2.9 — End-to-end voice acceptance

**Goal.** Prove [PRD.md](PRD.md) §7 live.

**Tasks (run, do not rebuild).**

1. Signed-in user speaks and hears an Engram-grounded reply.
2. Memory across turns **and** after a worker (and gateway if needed) restart on the same app session / resumed call rules Tauqueer confirms.
3. Barge-in stops playback.
4. Postgres + Azure hold transcript and both audio sides.
5. Second Google account cannot see the first user's session or audio.
6. Turn-level timings are present.

**Manual test.** The PRD §7 checklist passes. **Phase 2 done.**

**Done when.** Tauqueer has seen the checklist pass.

---

## 6. Cross-cutting definition of done for Phase 2

- Same Engram contracts as Phase 1 (no hand-built tenants; carry `session_id`; honest failures).
- No keyword/intent heuristics in the bridge, BYO shim, or voice UI.
- Every new value is config.
- Deepgram Settings and Chat Completions fields match the docs of the day this part is built.
- Each part's manual test is shown to Tauqueer before any commit.
