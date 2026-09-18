# Voice audio path

Reference. How sound gets from the member's microphone to Deepgram, and from the persona's reply
back out of the member's device. Transport and brain routing are in
[`../architecture.md`](../architecture.md); this file owns the **audio** layer only.

Behaviour is the code. This file owns intent. When they disagree about behaviour, believe
`frontend/src/lib/micCapture.ts`, `frontend/src/lib/pcmPlayback.ts`,
`frontend/src/lib/captureHold.ts` and `frontend/src/app/voice/VoicePage.tsx`.

Current known defects in this path: [`../reviews/voice-audio-2026-09-18.md`](../reviews/voice-audio-2026-09-18.md).
Work in flight: [`../plans/voice-audio.md`](../plans/voice-audio.md).

---

## 1. The two graphs

The browser runs **two** `AudioContext`s. They are never connected to each other.

| | Capture | Playback |
| --- | --- | --- |
| Created in | `micCapture.ts:62` | `pcmPlayback.ts:65` |
| Sample rate | `VITE_DEEPGRAM_AUDIO_INPUT_SAMPLE_RATE` (16000) | `VITE_DEEPGRAM_AUDIO_OUTPUT_SAMPLE_RATE` (24000) |
| Direction | mic → worklet → WebSocket | WebSocket → buffer sources → sink |
| Torn down by | `MicCapture.stop()` | `PcmPlayback.stop()` |

Both rates come from config and must match what the gateway tells Deepgram and Fish. The mic graph
resamples with `resampleLinear` against the context's **actual** `sampleRate`, because a browser may
not honour the requested rate.

## 2. Capture

```
getUserMedia({ channelCount, sampleRate,
               echoCancellation, noiseSuppression, autoGainControl })   ← all from config
    │
MediaStreamAudioSourceNode
    │
AudioWorkletNode  (worklet source is built at runtime, name from VITE_VOICE_WORKLET_NAME)
    │  port.postMessage(Float32Array) per render quantum
    ▼
resampleLinear → SampleAccumulator(VITE_VOICE_CAPTURE_FRAME_SAMPLES) → floatToInt16Le
    │
    ▼
socket.sendBinary(uplinkMicFrame(frame, held))
```

`SampleAccumulator` exists so the uplink emits **fixed-size** frames (320 samples ≈ 20 ms) rather
than whatever size the render quantum produced. Deepgram's endpointing is steadier with a regular
frame cadence.

`uplinkMicFrame(frame, held)` returns a zero-filled buffer of the **same length** when held, never a
shorter buffer and never nothing. Sending correctly-sized silence keeps the stream's timing intact;
sending nothing would look like a network stall.

The three processing flags are the pivot of this whole document — see §4.

## 3. Playback

```
socket binary (int16 LE PCM)
    │
int16LeToFloat → AudioBuffer → AudioBufferSourceNode.start(max(nextTime, now))
    │
  gain node ─────► sink
```

Chunks are scheduled back-to-back: each source starts at `max(nextTime, now)` and `nextTime`
advances by the buffer duration, so consecutive chunks join without a gap. A chunk that arrives late
starts at `now` and the schedule re-bases from there.

The gain node carries three levels, all from config
(`VITE_VOICE_PLAYBACK_SPEAK_GAIN`, `VITE_VOICE_PLAYBACK_DUCK_GAIN`):

- **speak** — normal reply playback.
- **duck** — the member is making interim words while the persona talks. Quieter, still playing.
- **flush** — silence, and every scheduled source stopped and dropped. Used by barge-in and by the
  interrupt control.

`flush()` returns whether anything was actually playing, so a caller can tell a real interruption
from a press against silence.

### The sink

Which sink the gain node feeds is **the open architectural question**, not settled state:

- `context.destination` — the hardware sink. `outputLatency` describes it accurately.
- `MediaStreamDestination` → hidden `<audio autoplay playsinline>` — added in `26a78c3` to get
  loudspeaker routing on Android. Adds an element buffer that no API exposes.

See §4 and [`../plans/voice-audio.md`](../plans/voice-audio.md) part 1.

## 4. Echo: the coupling that drives everything

A voice call over a loudspeaker has one hard problem. **The microphone hears the persona.** If that
echo reaches Deepgram, it transcribes the bot's own words as member speech and the call talks to
itself.

There are exactly two ways out, and they are mutually exclusive on Chrome:

### Acoustic echo cancellation

`echoCancellation: true` makes the browser subtract the rendered output from the captured input.
It is the correct answer — full duplex, the member can interrupt at any moment, no uplink gating.

The cost: opening a microphone with voice processing puts Chrome's audio session into
**communication mode**, and communication mode routes output to the **earpiece**. The phone must be
held to the ear like a phone call. This is true on Android, not only iOS.

### Half-duplex gating

`echoCancellation: false` leaves the session in normal media mode, so output reaches the
**loudspeaker**. The echo is then handled by not transmitting: while reply audio is playing, the
uplink sends silence.

The cost: the member cannot interrupt, because Deepgram never hears them during a reply. Every
barge-in mechanism in the codebase becomes unreachable. And the gate must know when playback has
*really* finished at the speaker — which is why §5 exists.

**The current tree is half-duplex**, with all three processing flags off. That was never recorded as
a decision; it emerged from a config default. Measuring both modes on a real device and locking the
result is part 1 of the plan.

## 5. The capture hold

Only meaningful in half-duplex mode. `captureHold.ts` answers one question: *is it still unsafe to
transmit the microphone?*

```
playbackHoldActive()          "is audio still coming out?"      — playback's view, context clock
      │
      ▼
noteCaptureHold(hold, active, now, gapMs)   extends a deadline  — page clock (performance.now)
      │
      ▼
captureHeld(hold, now)        "zero-fill this frame?"
```

Two clocks, deliberately. `playbackHoldActive` reasons in `AudioContext.currentTime` because that is
the clock the schedule lives on. The deadline lives in `performance.now()` because mic frames arrive
on the page timeline. They are never compared to each other.

`noteCaptureHold` only ever **extends** (`Math.max`), so an out-of-order frame cannot shorten a hold.
The deadline is re-armed on every frame while playback is active, then expires `gapMs` after the last
active frame. `gapMs` is two frame periods, derived from config rather than chosen
(`captureHoldGapMs`, 40 ms at 320 samples / 16 kHz).

### The drain window

Stopping the graph does not stop the sound. Audio already handed to the sink still has to leave the
speaker, and the uplink must stay closed for that long or the persona's last words loop back.

The window should be `outputLatency + baseLatency` plus a small margin. It is currently
`VITE_VOICE_CAPTURE_HOLD_AFTER_MS` = **2500 ms**, because the `<audio>` element hop added latency
that `outputLatency` does not describe and no API reports. That constant is a guess standing in for
an unobtainable measurement, and it costs the member the first 2.5 s of every reply
([review §3.2](../reviews/voice-audio-2026-09-18.md)).

**The drain window should be measured, not configured.** A sink whose latency is knowable makes this
value small and honest; that is the main argument for `context.destination` in part 1 of the plan.

## 6. Barge-in

Written for full duplex. Currently unreachable in the browser — recorded here because it is the
behaviour we intend, and part 2 of the plan either restores or removes it.

| Signal | Meaning | Response |
| --- | --- | --- |
| Interim user words while the persona speaks | might be a throat-clear, might be an interruption | **duck** — quieter, keep playing |
| Committed user start | a real interruption | **flush** — stop, drop the rest of the utterance |
| Agent thinking | a new turn begins | clear the drop |
| Agent audio done | that reply ended | clear the drop unless the member pressed interrupt |

The gateway mirrors this with a stricter rule: interim words start a clock and the persona only
yields once speech is *sustained* past `VOICE_BARGE_IN_HOLD_MS` (`applySpeechHold`). Deliberately not
the first word and not a VAD click — both fire on a throat-clear, and in speaker mode both fire on
the persona's own voice leaking back in.

Manual interrupt (the dock control) bypasses all of it: flush, hold the drop, return the floor.

## 7. Levels

The ring amplitude is driven from whichever side is live: mic RMS while listening, playback RMS while
speaking (`ringSourceForPhase`). Level updates are coalesced through one
`requestAnimationFrame` (`publishLevel`) so a 20 ms frame cadence cannot drive React renders.

## 8. Configuration

Every value in this path comes from env. No magic numbers in logic.

| Variable | Governs |
| --- | --- |
| `VITE_DEEPGRAM_AUDIO_INPUT_SAMPLE_RATE` | capture graph rate; must match what the gateway tells Deepgram |
| `VITE_DEEPGRAM_AUDIO_OUTPUT_SAMPLE_RATE` | playback graph rate; must match Aura and `FISH_TTS_SAMPLE_RATE` |
| `VITE_VOICE_CAPTURE_FRAME_SAMPLES` | uplink frame size, and the hold's gap via `captureHoldGapMs` |
| `VITE_VOICE_ECHO_CANCELLATION` | §4 — the pivot |
| `VITE_VOICE_NOISE_SUPPRESSION` | mic processing |
| `VITE_VOICE_AUTO_GAIN_CONTROL` | mic processing |
| `VITE_VOICE_AUDIO_LATENCY_HINT` | `interactive` trades buffer size for responsiveness |
| `VITE_VOICE_PLAYBACK_SPEAK_GAIN` | normal reply level |
| `VITE_VOICE_PLAYBACK_DUCK_GAIN` | level while the member is speaking over the persona |
| `VITE_VOICE_CAPTURE_HOLD_AFTER_MS` | drain window (§5) |
| `VOICE_BARGE_IN_HOLD_MS` | gateway: how long sustained speech must last to take the floor |
