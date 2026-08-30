import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import Grainient from "../../components/Grainient";
import { ApiError, api, googleSignInUrl, logoutUrl } from "../../lib/gateway";
import { startMicCapture, type MicCapture } from "../../lib/micCapture";
import { createPcmPlayback, type PcmPlayback } from "../../lib/pcmPlayback";
import { navigate } from "../../lib/router";
import { ROUTES } from "../../lib/routes";
import { loadVoiceClientConfig } from "../../lib/voiceConfig";
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

type CallStatus = "idle" | "starting" | "live";

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

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "request failed";
}

export function VoicePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [boot, setBoot] = useState<"loading" | "signed_out" | "ready">("loading");
  const [status, setStatus] = useState<string | null>(null);
  const [call, setCall] = useState<CallStatus>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const session = useRef<{
    socket: VoiceSocket | null;
    mic: MicCapture | null;
    playback: PcmPlayback | null;
    closedByUs: boolean;
  }>({ socket: null, mic: null, playback: null, closedByUs: false });

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

  async function endCall() {
    const current = session.current;
    current.closedByUs = true;
    session.current = {
      socket: null,
      mic: null,
      playback: null,
      closedByUs: true,
    };
    current.socket?.close();
    await current.mic?.stop();
    await current.playback?.stop();
    setCall("idle");
  }

  async function startCall() {
    if (call !== "idle") {
      return;
    }
    setCall("starting");
    setStatus(null);
    setSessionId(null);
    try {
      const config = loadVoiceClientConfig();
      session.current.closedByUs = false;
      const playback = createPcmPlayback(config);
      session.current.playback = playback;
      const live = { current: false };
      const mic = await startMicCapture(config, (frame) => {
        if (live.current) {
          session.current.socket?.sendBinary(frame);
        }
      });
      session.current.mic = mic;
      const socket = openVoiceSocket(config, {
        onReady: (ready) => {
          live.current = true;
          setSessionId(ready.sessionId);
          setCall("live");
        },
        onBinary: (bytes) => {
          playback.enqueue(bytes);
        },
        onError: (message) => {
          setStatus(message);
          void endCall();
        },
        onClose: () => {
          if (!session.current.closedByUs) {
            setStatus("The voice connection dropped");
          }
          void endCall();
        },
      });
      session.current.socket = socket;
    } catch (error) {
      setStatus(errorMessage(error));
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

  const live = call === "live";
  const busy = call === "starting";

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
            <p style={{ color: "var(--text-mid)" }}>
              Speak after the call is live. The same persona and memory as typed chat.
            </p>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              {live ? (
                <Button type="button" variant="danger" onClick={() => void endCall()}>
                  End call
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="solid"
                  disabled={busy}
                  onClick={() => void startCall()}
                >
                  {call === "starting" ? "Starting…" : "Start call"}
                </Button>
              )}
              <Badge>
                {live ? "Live" : call === "starting" ? "Connecting" : "Idle"}
              </Badge>
              {sessionId && <Badge>Session saved</Badge>}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
