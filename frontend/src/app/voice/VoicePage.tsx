import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Badge, type BadgeTone } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { BarMeter } from "../../components/ui/Meter";
import Grainient from "../../components/Grainient";
import { ApiError, api, googleSignInUrl, logoutUrl } from "../../lib/gateway";
import { createVoiceBargeIn, type VoiceBargeIn } from "../../lib/bargeIn";
import { startMicCapture, type MicCapture } from "../../lib/micCapture";
import { createPcmPlayback, type PcmPlayback } from "../../lib/pcmPlayback";
import { navigate } from "../../lib/router";
import { ROUTES } from "../../lib/routes";
import { loadVoiceClientConfig, type VoiceClientConfig } from "../../lib/voiceConfig";
import { openVoiceSocket, type VoiceSocket } from "../../lib/voiceSocket";

type Me = {
  id: string;
  email: string;
  owner: boolean;
};

type Persona = {
  id: string;
  handle: string;
  display_name: string;
  description: string | null;
};

type ChatGetResponse = {
  persona: Persona;
};

type CallPhase =
  | "idle"
  | "starting"
  | "listening"
  | "thinking"
  | "speaking"
  | "error";

type TranscriptLine = {
  role: string;
  content: string;
};

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  position: "relative",
  padding: "32px 20px 72px",
  color: "var(--text-hi)",
  fontFamily: "var(--font-body)",
};

const wrapStyle: CSSProperties = {
  position: "relative",
  zIndex: 1,
  maxWidth: 840,
  margin: "0 auto",
  display: "grid",
  gap: 18,
};

const headStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
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
  if (phase === "error") {
    return "Error";
  }
  return "Idle";
}

function phaseTone(phase: CallPhase): BadgeTone {
  if (phase === "listening") {
    return "positive";
  }
  if (phase === "thinking" || phase === "speaking") {
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
  const [me, setMe] = useState<Me | null>(null);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [boot, setBoot] = useState<"loading" | "signed_out" | "ready">("loading");
  const [status, setStatus] = useState<string | null>(null);
  const [phase, setPhase] = useState<CallPhase>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [turns, setTurns] = useState<TranscriptLine[]>([]);
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
    closedByUs: boolean;
    levelRaf: number | null;
    pendingLevel: number;
  }>({
    socket: null,
    mic: null,
    playback: null,
    bargeIn: null,
    closedByUs: false,
    levelRaf: null,
    pendingLevel: 0,
  });
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const identity = await api<Me>("/api/me");
        if (cancelled) return;
        setMe(identity);
        try {
          const context = await api<ChatGetResponse>("/api/chat");
          if (cancelled) return;
          setPersona(context.persona);
        } catch (error) {
          if (cancelled) return;
          setStatus(errorMessage(error));
        }
        setBoot("ready");
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          setBoot("signed_out");
          return;
        }
        setStatus(errorMessage(error));
        setBoot("signed_out");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      void endCall();
    };
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
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
    if (current.levelRaf !== null) {
      window.cancelAnimationFrame(current.levelRaf);
    }
    session.current = {
      socket: null,
      mic: null,
      playback: null,
      bargeIn: null,
      closedByUs: true,
      levelRaf: null,
      pendingLevel: 0,
    };
    current.socket?.close();
    await current.mic?.stop();
    await current.playback?.stop();
    setVu(0);
    setLevels([]);
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
      session.current.bargeIn?.onUserStarted(() => {
        session.current.playback?.flush();
      });
      setPhase("listening");
      return;
    }
    if (type === config.thinkingType) {
      setPhase("thinking");
      return;
    }
    if (type === config.audioDoneType) {
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
  }

  async function startCall() {
    if (phase !== "idle" && phase !== "error") {
      return;
    }
    setPhase("starting");
    setStatus(null);
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
      const socket = openVoiceSocket(config, {
        onReady: (ready) => {
          live.current = true;
          setSessionId(ready.sessionId);
          setPhase("listening");
        },
        onBinary: (bytes) => {
          if (!bargeIn.acceptBinary()) {
            return;
          }
          setPhase("speaking");
          playback.enqueue(bytes);
        },
        onAgentEvent: (event) => {
          applyAgentEvent(config, event);
        },
        onError: (message) => {
          setStatus(message);
          setPhase("error");
          void endCall();
        },
        onClose: () => {
          if (!session.current.closedByUs) {
            setStatus("The voice connection dropped");
            setPhase("error");
          }
          void endCall();
        },
      });
      session.current.socket = socket;
    } catch (error) {
      setStatus(errorMessage(error));
      setPhase("error");
      await endCall();
    }
  }

  if (boot === "loading") {
    return (
      <div style={pageStyle}>
        <Grainient color3="#202028" saturation={0.7} />
        <div style={wrapStyle}>
          <p>Loading…</p>
        </div>
      </div>
    );
  }

  if (boot === "signed_out") {
    return (
      <div style={pageStyle}>
        <Grainient color3="#202028" saturation={0.7} />
        <div style={wrapStyle}>
          <Card>
            <h1 className="mc-pagehead__title" style={{ marginBottom: 8 }}>
              Voice
            </h1>
            <p style={{ color: "var(--text-mid)", marginBottom: 18 }}>
              Sign in with Google to talk to the persona.
            </p>
            {status && <p className="ui-field__error">{status}</p>}
            <Button
              variant="solid"
              onClick={() => {
                window.location.href = googleSignInUrl(ROUTES.voice);
              }}
            >
              Continue with Google
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const inCall =
    phase === "listening" || phase === "thinking" || phase === "speaking";
  const starting = phase === "starting";

  return (
    <div style={pageStyle}>
      <Grainient color3="#202028" saturation={0.7} />
      <div style={wrapStyle}>
        <div style={headStyle}>
          <div>
            <h1 className="mc-pagehead__title">{persona?.display_name ?? "Persona"}</h1>
            <p style={{ color: "var(--text-mid)", marginTop: 6 }}>
              {persona?.handle ? `@${persona.handle}` : null}
              {persona?.handle && me?.email ? " · " : null}
              {me?.email}
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Button type="button" onClick={() => navigate(ROUTES.chat)}>
              Chat
            </Button>
            {me?.owner && (
              <Button type="button" onClick={() => navigate(ROUTES.admin)}>
                Admin
              </Button>
            )}
            <Button
              type="button"
              onClick={() => {
                window.location.href = logoutUrl(ROUTES.voice);
              }}
            >
              Sign out
            </Button>
          </div>
        </div>

        {status && (
          <Card>
            <p className="ui-field__error">{status}</p>
          </Card>
        )}

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
                  disabled={starting}
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
            {phase === "thinking" && (
              <p style={{ color: "var(--text-mid)" }}>Thinking…</p>
            )}
            <div ref={bottom} />
          </div>
        </Card>
      </div>
    </div>
  );
}
