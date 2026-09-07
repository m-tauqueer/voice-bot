import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Badge, type BadgeTone } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { BarMeter } from "../../components/ui/Meter";
import { ApiError, api } from "../../lib/gateway";
import { createVoiceBargeIn, type VoiceBargeIn } from "../../lib/bargeIn";
import { startMicCapture, type MicCapture } from "../../lib/micCapture";
import { createThinkingCue, type ThinkingCue } from "../../lib/thinkingCue";
import { createPcmPlayback, type PcmPlayback } from "../../lib/pcmPlayback";
import { loadNavConfig } from "../../lib/nav";
import { loadVoiceClientConfig, voiceSocketUrl, type VoiceClientConfig } from "../../lib/voiceConfig";
import { openVoiceSocket, type VoiceSocket } from "../../lib/voiceSocket";
import { loadUiCopy } from "../../lib/uiCopy";
import {
  parsePublishedDirectory,
  type PublishedPersona,
} from "../../lib/publishedPersonas";
import { PersonaPicker } from "../PersonaPicker";
import { useSession } from "../session";

type CallPhase =
  | "idle"
  | "starting"
  | "listening"
  | "thinking"
  | "speaking"
  | "reconnecting"
  | "error";

type Banner = {
  tone: "error" | "warning";
  text: string;
};

type TranscriptLine = {
  role: string;
  content: string;
};

const wrapStyle: CSSProperties = {
  maxWidth: 840,
  margin: "0 auto",
  display: "grid",
  gap: 18,
};

const bubbleStyle = (fromUser: boolean): CSSProperties => ({
  justifySelf: fromUser ? "end" : "start",
  maxWidth: "85%",
  padding: "12px 14px",
  borderRadius: 14,
  background: fromUser ? "var(--surface-2)" : "var(--surface-1)",
  color: "var(--text-hi)",
  whiteSpace: "pre-wrap",
});

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "request failed";
}

function phaseLabel(phase: CallPhase): string {
  if (phase === "starting") {
    return "Connecting";
  }
  if (phase === "listening") {
    return "Listening";
  }
  if (phase === "thinking") {
    return "Thinking";
  }
  if (phase === "speaking") {
    return "Speaking";
  }
  if (phase === "reconnecting") {
    return "Reconnecting";
  }
  if (phase === "error") {
    return "Error";
  }
  return "Idle";
}

function phaseTone(phase: CallPhase): BadgeTone {
  if (phase === "listening") {
    return "positive";
  }
  if (phase === "thinking" || phase === "speaking" || phase === "reconnecting") {
    return "accent";
  }
  if (phase === "error") {
    return "negative";
  }
  return "neutral";
}

function eventRole(event: Record<string, unknown>): string | null {
  if (typeof event.role === "string" && event.role.length > 0) {
    return event.role;
  }
  if (typeof event.speaker === "string" && event.speaker.length > 0) {
    return event.speaker;
  }
  return null;
}

function eventContent(event: Record<string, unknown>): string | null {
  if (typeof event.content === "string") {
    return event.content;
  }
  if (typeof event.text === "string") {
    return event.text;
  }
  return null;
}

export function VoicePage() {
  const identity = useSession();
  const copy = loadUiCopy();
  const { loadingLabel } = loadNavConfig();
  const me = identity.status === "ready" ? identity.me : null;
  const [boot, setBoot] = useState<"loading" | "ready">("loading");
  const [banner, setBanner] = useState<Banner | null>(null);
  const [phase, setPhase] = useState<CallPhase>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [turns, setTurns] = useState<TranscriptLine[]>([]);
  const [directory, setDirectory] = useState<PublishedPersona[]>([]);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [vu, setVu] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const [clientConfig, setClientConfig] = useState<VoiceClientConfig | null>(
    null,
  );
  const session = useRef<{
    socket: VoiceSocket | null;
    mic: MicCapture | null;
    playback: PcmPlayback | null;
    bargeIn: VoiceBargeIn | null;
    thinkingCue: ThinkingCue | null;
    closedByUs: boolean;
    levelRaf: number | null;
    pendingLevel: number;
  }>({
    socket: null,
    mic: null,
    playback: null,
    bargeIn: null,
    thinkingCue: null,
    closedByUs: false,
    levelRaf: null,
    pendingLevel: 0,
  });
  const picked = directory.find((row) => row.id === pickedId) ?? null;
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!me) {
      setBoot("ready");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const payload = await api<{ personas?: unknown }>("/api/personas");
        if (cancelled) {
          return;
        }
        setDirectory(parsePublishedDirectory(payload));
      } catch (error) {
        if (!cancelled) {
          setBanner({ tone: "error", text: errorMessage(error) });
        }
      } finally {
        if (!cancelled) {
          setBoot("ready");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [me]);

  useEffect(() => {
    return () => {
      void endCall();
    };
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView?.({ block: "end" });
  }, [turns, phase]);

  function publishLevel(level: number) {
    session.current.pendingLevel = level;
    if (session.current.levelRaf !== null) {
      return;
    }
    session.current.levelRaf = window.requestAnimationFrame(() => {
      session.current.levelRaf = null;
      const next = session.current.pendingLevel;
      setVu(Math.round(next * 100));
      setLevels((current) => {
        if (current.length === 0) {
          return current;
        }
        return [...current.slice(1), next];
      });
    });
  }

  async function endCall() {
    const current = session.current;
    current.closedByUs = true;
    current.bargeIn?.dispose();
    current.thinkingCue?.stop();
    if (current.levelRaf !== null) {
      window.cancelAnimationFrame(current.levelRaf);
    }
    session.current = {
      socket: null,
      mic: null,
      playback: null,
      bargeIn: null,
      thinkingCue: null,
      closedByUs: true,
      levelRaf: null,
      pendingLevel: 0,
    };
    current.socket?.close();
    await current.mic?.stop();
    await current.playback?.stop();
    setVu(0);
    setLevels([]);
    setTurns([]);
    setSessionId(null);
    setPhase("idle");
  }

  function applyAgentEvent(
    config: VoiceClientConfig,
    event: Record<string, unknown>,
  ) {
    const type = typeof event.type === "string" ? event.type : null;
    if (!type) {
      return;
    }
    if (type === config.userStartedType) {
      session.current.thinkingCue?.stop();
      session.current.bargeIn?.onUserStarted(() => {
        session.current.playback?.flush();
      });
      setPhase("listening");
      return;
    }
    if (type === config.thinkingType) {
      // A new agent turn: any drop left over from an interruption is cleared.
      session.current.bargeIn?.onAgentThinking();
      session.current.thinkingCue?.start();
      setPhase("thinking");
      return;
    }
    if (type === config.audioDoneType) {
      session.current.thinkingCue?.stop();
      session.current.bargeIn?.onAgentAudioDone();
      setPhase("listening");
      return;
    }
    if (type !== config.conversationTextType) {
      return;
    }
    const role = eventRole(event);
    const content = eventContent(event);
    if (!role || content === null) {
      return;
    }
    const interim = event.final === false;
    setTurns((current) => {
      if (interim && current.length > 0) {
        const last = current[current.length - 1];
        if (last && last.role === role) {
          return [...current.slice(0, -1), { role, content }];
        }
      }
      return [...current, { role, content }];
    });
    if (!interim && role === config.transcriptUserRole) {
      // The caller's turn has been transcribed, so the brain is now working.
      // This is the signal the transport actually sends; it does not announce
      // thinking separately.
      session.current.bargeIn?.onAgentThinking();
      session.current.thinkingCue?.start();
      setPhase("thinking");
    }
  }

  async function startCall() {
    if ((phase !== "idle" && phase !== "error") || !picked) {
      return;
    }
    setPhase("starting");
    setBanner(null);
    setSessionId(null);
    setTurns([]);
    try {
      const config = loadVoiceClientConfig();
      setClientConfig(config);
      setLevels(Array.from({ length: config.vuBarCount }, () => 0));
      session.current.closedByUs = false;
      const playback = createPcmPlayback(config);
      session.current.playback = playback;
      const bargeIn = createVoiceBargeIn();
      session.current.bargeIn = bargeIn;
      const thinkingCue = createThinkingCue(config);
      session.current.thinkingCue = thinkingCue;
      const live = { current: false };
      const mic = await startMicCapture(config, {
        onFrame: (frame) => {
          if (live.current) {
            session.current.socket?.sendBinary(frame);
          }
        },
        onLevel: publishLevel,
      });
      session.current.mic = mic;
      const socket = openVoiceSocket(
        { ...config, wsUrl: voiceSocketUrl(config, picked.id) },
        {
        onReady: (ready) => {
          live.current = true;
          setSessionId(ready.sessionId);
          setPhase("listening");
        },
        onBinary: (bytes) => {
          if (!bargeIn.acceptBinary()) {
            return;
          }
          thinkingCue.stop();
          setPhase("speaking");
          playback.enqueue(bytes);
        },
        onAgentEvent: (event) => {
          applyAgentEvent(config, event);
        },
        onError: (message) => {
          setBanner({ tone: "error", text: message });
          setPhase("error");
          void endCall();
        },
        onWarning: (message, code) => {
          setBanner({ tone: "warning", text: message });
          if (code === config.reconnectingCode) {
            setPhase("reconnecting");
            return;
          }
          if (code === config.reconnectedCode) {
            setPhase("listening");
          }
        },
        onClose: () => {
          if (!session.current.closedByUs) {
            setBanner({ tone: "error", text: config.connectionDropped });
            setPhase("error");
          }
          void endCall();
        },
      });
      session.current.socket = socket;
    } catch (error) {
      setBanner({ tone: "error", text: errorMessage(error) });
      setPhase("error");
      await endCall();
    }
  }

  if (!me || boot === "loading") {
    return (
      <div style={wrapStyle}>
        <p>{loadingLabel}</p>
      </div>
    );
  }

  const inCall =
    phase === "listening" ||
    phase === "thinking" ||
    phase === "speaking" ||
    phase === "reconnecting";
  const starting = phase === "starting";
  const pickingLocked = inCall || starting;

  return (
    <div style={wrapStyle}>
        <div>
          <h1 className="mc-pagehead__title">
            {picked?.display_name ?? copy.personaPickerTitle}
          </h1>
          <p style={{ color: "var(--text-mid)", marginTop: 6 }}>
            {picked?.handle ? `@${picked.handle}` : copy.personaPickerHelp}
          </p>
        </div>

        {banner && (
          <Card>
            <p
              className="ui-field__error"
              style={
                banner.tone === "warning"
                  ? { color: "var(--text-mid)" }
                  : undefined
              }
            >
              {banner.text}
            </p>
          </Card>
        )}

        <PersonaPicker
          directory={directory}
          pickedId={pickedId}
          locked={pickingLocked}
          title={copy.personaPickerTitle}
          empty={copy.personaPickerEmpty}
          help={copy.personaPickerHelp}
          onPick={setPickedId}
        />

        <Card>
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              {inCall ? (
                <Button type="button" variant="danger" onClick={() => void endCall()}>
                  End call
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="solid"
                  disabled={starting || !picked}
                  onClick={() => void startCall()}
                >
                  {starting ? "Starting…" : "Start call"}
                </Button>
              )}
              <Badge tone={phaseTone(phase)}>{phaseLabel(phase)}</Badge>
              {sessionId && <Badge>Session saved</Badge>}
            </div>
            {(inCall || starting) && (
              <>
                <BarMeter value={vu} label="Mic" accent={phase === "listening"} />
                {levels.length > 0 && (
                  <div
                    aria-hidden="true"
                    style={{
                      display: "flex",
                      alignItems: "flex-end",
                      gap: 3,
                      height: 48,
                    }}
                  >
                    {levels.map((level, index) => (
                      <span
                        key={index}
                        style={{
                          flex: 1,
                          height: `${Math.max(8, Math.round(level * 100))}%`,
                          background: "var(--text-hi)",
                          opacity: 0.28 + level * 0.72,
                          borderRadius: 2,
                        }}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </Card>

        <Card>
          <div style={{ display: "grid", gap: 10, minHeight: 280 }}>
            {turns.length === 0 && (
              <p style={{ color: "var(--text-mid)" }}>
                {inCall
                  ? "Speak when the badge says Listening."
                  : "Start a call to see the live transcript."}
              </p>
            )}
            {turns.map((turn, index) => (
              <div
                key={`${turn.role}-${index}`}
                style={bubbleStyle(
                  turn.role === (clientConfig?.transcriptUserRole ?? ""),
                )}
              >
                {turn.content}
              </div>
            ))}
            {phase === "thinking" && clientConfig && (
              <p style={{ color: "var(--text-mid)" }}>
                {clientConfig.thinkingCueLabel}
              </p>
            )}
            <div ref={bottom} />
          </div>
        </Card>
    </div>
  );
}
