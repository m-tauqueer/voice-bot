import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { CallPhaseBadge } from "../../components/voice/CallPhaseBadge";
import { VoiceRing } from "../../components/voice/VoiceRing";
import { ApiError, api } from "../../lib/gateway";
import { createVoiceBargeIn, type VoiceBargeIn } from "../../lib/bargeIn";
import { callIsLive, type CallPhase } from "../../lib/callPhase";
import { startMicCapture, type MicCapture } from "../../lib/micCapture";
import { createThinkingCue, type ThinkingCue } from "../../lib/thinkingCue";
import { createPcmPlayback, type PcmPlayback } from "../../lib/pcmPlayback";
import { loadNavConfig } from "../../lib/nav";
import { ringAmplitude, ringSourceForPhase } from "../../lib/ringAmplitude";
import { loadVoiceClientConfig, voiceSocketUrl, type VoiceClientConfig } from "../../lib/voiceConfig";
import { openVoiceSocket, type VoiceSocket } from "../../lib/voiceSocket";
import { loadUiCopy } from "../../lib/uiCopy";
import {
  parsePublishedDirectory,
  type PublishedPersona,
} from "../../lib/publishedPersonas";
import { useSession } from "../session";
import { AgentSelector } from "./AgentSelector";

type Banner = {
  tone: "error" | "warning";
  text: string;
};

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
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
  const voiceUi = loadVoiceClientConfig();
  const { loadingLabel } = loadNavConfig();
  const me = identity.status === "ready" ? identity.me : null;
  const [boot, setBoot] = useState<"loading" | "ready">("loading");
  const [banner, setBanner] = useState<Banner | null>(null);
  const [phase, setPhase] = useState<CallPhase>("idle");
  const [directory, setDirectory] = useState<PublishedPersona[]>([]);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [signalLevel, setSignalLevel] = useState(0);
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
  const phaseRef = useRef<CallPhase>(phase);
  phaseRef.current = phase;
  const picked = directory.find((row) => row.id === pickedId) ?? null;

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
          setBanner({ tone: "error", text: errorMessage(error, copy.requestFailed) });
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

  function publishLevel(level: number) {
    session.current.pendingLevel = level;
    if (session.current.levelRaf !== null) {
      return;
    }
    session.current.levelRaf = window.requestAnimationFrame(() => {
      session.current.levelRaf = null;
      setSignalLevel(session.current.pendingLevel);
    });
  }

  function publishMicLevel(level: number) {
    if (ringSourceForPhase(phaseRef.current) !== "mic") {
      return;
    }
    publishLevel(level);
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
    setSignalLevel(0);
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
      session.current.bargeIn?.onAgentThinking();
      session.current.thinkingCue?.start();
      setSignalLevel(0);
      setPhase("thinking");
      return;
    }
    if (type === config.audioDoneType) {
      session.current.thinkingCue?.stop();
      session.current.playback?.restore();
      session.current.bargeIn?.onAgentAudioDone();
      setSignalLevel(0);
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
    if (
      interim &&
      role === config.transcriptUserRole &&
      content.trim().length > 0
    ) {
      session.current.bargeIn?.onUserInterim(() => {
        session.current.playback?.duck();
      });
    }
    if (!interim && role === config.transcriptUserRole) {
      session.current.bargeIn?.onAgentThinking();
      session.current.thinkingCue?.start();
      setSignalLevel(0);
      setPhase("thinking");
    }
  }

  async function startCall() {
    if ((phase !== "idle" && phase !== "error") || !picked) {
      return;
    }
    setPhase("starting");
    setBanner(null);
    try {
      const config = loadVoiceClientConfig();
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
        onLevel: publishMicLevel,
      });
      session.current.mic = mic;
      const socket = openVoiceSocket(
        { ...config, wsUrl: voiceSocketUrl(config, picked.id) },
        {
        onReady: () => {
          live.current = true;
          setPhase("listening");
        },
        onBinary: (bytes) => {
          if (!bargeIn.acceptBinary()) {
            return;
          }
          thinkingCue.stop();
          setPhase("speaking");
          playback.enqueue(bytes);
          publishLevel(playback.level());
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
      setBanner({ tone: "error", text: errorMessage(error, copy.requestFailed) });
      setPhase("error");
      await endCall();
    }
  }

  function leaveSitting() {
    if (callIsLive(phase) || phase === "starting") {
      return;
    }
    setPickedId(null);
    setBanner(null);
    setPhase("idle");
  }

  function toggleCall() {
    if (callIsLive(phase)) {
      void endCall();
      return;
    }
    void startCall();
  }

  if (!me || boot === "loading") {
    return (
      <div className="voice-pick">
        <p>{loadingLabel}</p>
      </div>
    );
  }

  const inCall = callIsLive(phase);
  const starting = phase === "starting";
  const amplitude = ringAmplitude({
    source: ringSourceForPhase(phase),
    level: signalLevel,
    idle: voiceUi.ringIdleAmplitude,
    activeMin: voiceUi.ringActiveMin,
    activeMax: voiceUi.ringActiveMax,
  });

  if (!picked) {
    return (
      <div className="voice-pick">
        <div className="voice-pick__stack">
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
          <AgentSelector
            directory={directory}
            title={copy.personaPickerTitle}
            empty={copy.personaPickerEmpty}
            help={copy.personaPickerHelp}
            config={voiceUi}
            onPick={setPickedId}
          />
        </div>
      </div>
    );
  }

  const callLabel = inCall
    ? copy.callEndLabel
    : starting
      ? copy.callStartingLabel
      : copy.callStartLabel;

  return (
    <div
      className="voice-sit"
      role="region"
      aria-label={picked.display_name}
      style={{
        ["--voice-amp" as string]: String(amplitude),
        ["--voice-btn-size" as string]: `${voiceUi.ringButtonPx}px`,
        ["--voice-btn-scale" as string]: String(voiceUi.ringButtonScale),
      }}
    >
      <VoiceRing
        amplitude={amplitude}
        smoothing={voiceUi.ringSmoothing}
        className="voice-sit__canvas"
      />
      {!inCall && !starting && (
        <div className="voice-sit__back">
          <Button type="button" variant="ghost" onClick={leaveSitting}>
            {copy.callBackLabel}
          </Button>
        </div>
      )}
      <CallPhaseBadge phase={phase} copy={copy} config={voiceUi} />
      {banner && (
        <div className="voice-sit__banner">
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
        </div>
      )}
      <button
        type="button"
        className="voice-sit__mic"
        disabled={starting}
        aria-label={callLabel}
        onClick={toggleCall}
      />
    </div>
  );
}