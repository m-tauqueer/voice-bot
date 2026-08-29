import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Textarea } from "../../components/ui/Input";
import Grainient from "../../components/Grainient";
import {
  ApiError,
  api,
  clearStoredChatSessionId,
  googleSignInUrl,
  logoutUrl,
  readStoredChatSessionId,
  writeStoredChatSessionId,
} from "../../lib/gateway";
import { navigate } from "../../lib/router";
import { ROUTES } from "../../lib/routes";

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

const bubbleStyle = (speaker: string): CSSProperties => ({
  justifySelf: speaker === "user" ? "end" : "start",
  maxWidth: "85%",
  padding: "12px 14px",
  borderRadius: 14,
  background: speaker === "user" ? "var(--surface-2)" : "var(--surface-1)",
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
  const [me, setMe] = useState<Me | null>(null);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [boot, setBoot] = useState<"loading" | "signed_out" | "ready">("loading");
  const [status, setStatus] = useState<string | null>(null);
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
          const stored = readStoredChatSessionId(identity.id);
          if (stored) {
            try {
              const history = await api<ChatGetResponse>(
                `/api/chat?session_id=${encodeURIComponent(stored)}`,
              );
              if (cancelled) return;
              setTurns(history.turns);
              applySession(identity.id, stored);
            } catch (error) {
              if (error instanceof ApiError && error.status === 404) {
                clearStoredChatSessionId(identity.id);
              } else {
                setStatus(errorMessage(error));
              }
            }
          }
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
  }, [applySession]);

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
    setStatus(null);
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
      const history = await api<ChatGetResponse>(
        `/api/chat?session_id=${encodeURIComponent(result.session_id)}`,
      );
      setTurns(history.turns);
      if (result.reply_text == null) {
        setStatus("The persona stayed silent.");
      }
    } catch (error) {
      setDraft(text);
      setStatus(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  function startFresh() {
    if (!me) return;
    clearStoredChatSessionId(me.id);
    setSessionId(null);
    setTurns([]);
    setStatus(null);
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
              Chat
            </h1>
            <p style={{ color: "var(--text-mid)", marginBottom: 18 }}>
              Sign in with Google to talk to the persona.
            </p>
            {status && <p className="ui-field__error">{status}</p>}
            <Button
              variant="solid"
              onClick={() => {
                window.location.href = googleSignInUrl(ROUTES.chat);
              }}
            >
              Continue with Google
            </Button>
          </Card>
        </div>
      </div>
    );
  }

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
            {me?.owner && (
              <Button type="button" onClick={() => navigate(ROUTES.admin)}>
                Admin
              </Button>
            )}
            <Button type="button" onClick={startFresh} disabled={busy}>
              New conversation
            </Button>
            <Button
              type="button"
              onClick={() => {
                window.location.href = logoutUrl(ROUTES.chat);
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
          <div style={{ display: "grid", gap: 10, minHeight: 280 }}>
            {turns.length === 0 && !busy && (
              <p style={{ color: "var(--text-mid)" }}>
                Say something. Memory is kept on the server, so it survives a restart.
              </p>
            )}
            {turns.map((turn) => (
              <div key={turn.ordinal} style={bubbleStyle(turn.speaker)}>
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
    </div>
  );
}
