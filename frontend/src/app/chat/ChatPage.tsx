import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Textarea } from "../../components/ui/Input";
import {
  ApiError,
  api,
  chatSilenceStatus,
  clearStoredChatSessionId,
  readStoredChatSessionId,
  turnSpeakerPersona,
  turnSpeakerUser,
  writeStoredChatSessionId,
} from "../../lib/gateway";
import { loadNavConfig } from "../../lib/nav";
import { useSession } from "../session";

type Persona = {
  id: string;
  handle: string;
  display_name: string;
  description: string | null;
};

type TranscriptTurn = {
  ordinal: number;
  speaker: string;
  text: string;
};

type ChatGetResponse = {
  persona: Persona;
  session_id?: string;
  turns: TranscriptTurn[];
};

type ChatPostResponse = {
  action: string;
  reply_text: string | null;
  session_id: string;
  reasons: string[];
  recorded?: boolean;
  warning?: string | null;
  warning_code?: string | null;
};

type Banner = {
  tone: "error" | "warning";
  text: string;
};

const wrapStyle: CSSProperties = {
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

const bubbleStyle = (speaker: string, userSpeaker: string): CSSProperties => ({
  justifySelf: speaker === userSpeaker ? "end" : "start",
  maxWidth: "85%",
  padding: "12px 14px",
  borderRadius: 14,
  background: speaker === userSpeaker ? "var(--surface-2)" : "var(--surface-1)",
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

export function ChatPage() {
  const session = useSession();
  const { loadingLabel, appName } = loadNavConfig();
  const me = session.status === "ready" ? session.me : null;
  const [persona, setPersona] = useState<Persona | null>(
    session.status === "ready" ? session.persona : null,
  );
  const [boot, setBoot] = useState<"loading" | "ready">("loading");
  const [banner, setBanner] = useState<Banner | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const applySession = useCallback((userId: string, next: string) => {
    setSessionId(next);
    writeStoredChatSessionId(userId, next);
  }, []);

  useEffect(() => {
    if (!me) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const context = await api<ChatGetResponse>("/api/chat");
        if (cancelled) return;
        setPersona(context.persona);
        const stored = readStoredChatSessionId(me.id);
        if (stored) {
          try {
            const history = await api<ChatGetResponse>(
              `/api/chat?session_id=${encodeURIComponent(stored)}`,
            );
            if (cancelled) return;
            setTurns(history.turns);
            applySession(me.id, stored);
          } catch (error) {
            if (error instanceof ApiError && error.status === 404) {
              clearStoredChatSessionId(me.id);
            } else {
              setBanner({ tone: "error", text: errorMessage(error) });
            }
          }
        }
      } catch (error) {
        if (cancelled) return;
        setBanner({ tone: "error", text: errorMessage(error) });
      }
      setBoot("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [applySession, me]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [turns, busy]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!me || !text || busy) {
      return;
    }
    setBusy(true);
    setBanner(null);
    setDraft("");
    try {
      const payload: { text: string; session_id?: string } = { text };
      if (sessionId) {
        payload.session_id = sessionId;
      }
      const result = await api<ChatPostResponse>("/api/chat", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      applySession(me.id, result.session_id);
      if (result.recorded === false) {
        const userSpeaker = turnSpeakerUser();
        const personaSpeaker = turnSpeakerPersona();
        setTurns((current) => {
          const next = [...current];
          const lastOrdinal = next.at(-1)?.ordinal ?? 0;
          next.push({
            ordinal: lastOrdinal + 1,
            speaker: userSpeaker,
            text,
          });
          if (result.reply_text) {
            next.push({
              ordinal: lastOrdinal + 2,
              speaker: personaSpeaker,
              text: result.reply_text,
            });
          }
          return next;
        });
      } else {
        const history = await api<ChatGetResponse>(
          `/api/chat?session_id=${encodeURIComponent(result.session_id)}`,
        );
        setTurns(history.turns);
      }
      if (result.warning) {
        setBanner({ tone: "warning", text: result.warning });
      } else if (result.reply_text == null) {
        setBanner({ tone: "warning", text: chatSilenceStatus() });
      }
    } catch (error) {
      setDraft(text);
      setBanner({ tone: "error", text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  function startFresh() {
    if (!me) return;
    clearStoredChatSessionId(me.id);
    setSessionId(null);
    setTurns([]);
    setBanner(null);
  }

  if (!me || boot === "loading") {
    return (
      <div style={wrapStyle}>
        <p>{loadingLabel}</p>
      </div>
    );
  }

  return (
    <div style={wrapStyle}>
        <div style={headStyle}>
          <div>
            <h1 className="mc-pagehead__title">{persona?.display_name ?? appName}</h1>
            <p style={{ color: "var(--text-mid)", marginTop: 6 }}>
              {persona?.handle ? `@${persona.handle}` : null}
            </p>
          </div>
          <Button type="button" onClick={startFresh} disabled={busy}>
            New conversation
          </Button>
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

        <Card>
          <div style={{ display: "grid", gap: 10, minHeight: 280 }}>
            {turns.length === 0 && !busy && (
              <p style={{ color: "var(--text-mid)" }}>
                Say something. Memory is kept on the server, so it survives a restart.
              </p>
            )}
            {turns.map((turn) => (
              <div key={turn.ordinal} style={bubbleStyle(turn.speaker, turnSpeakerUser())}>
                {turn.text}
              </div>
            ))}
            {busy && (
              <p style={{ color: "var(--text-mid)" }}>Thinking…</p>
            )}
            <div ref={bottom} />
          </div>
        </Card>

        <Card>
          <form onSubmit={send} style={{ display: "grid", gap: 12 }}>
            <Textarea
              label="Message"
              rows={3}
              value={draft}
              disabled={busy}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <Button
                type="submit"
                variant="solid"
                disabled={busy || draft.trim().length === 0}
              >
                {busy ? "Sending…" : "Send"}
              </Button>
              {sessionId && <Badge>Session saved</Badge>}
            </div>
          </form>
        </Card>
    </div>
  );
}
