import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Textarea } from "../../components/ui/Input";
import {
  ApiError,
  api,
  chatSilenceStatus,
  turnSpeakerPersona,
  turnSpeakerUser,
} from "../../lib/gateway";
import {
  clearStoredChatSessionId,
  readStoredChatSessionId,
  writeStoredChatSessionId,
} from "../../lib/chatSession";
import { personaPinField } from "../../lib/personaVoice";
import {
  parsePublishedDirectory,
  type PublishedPersona,
} from "../../lib/publishedPersonas";
import { loadNavConfig } from "../../lib/nav";
import { loadUiCopy } from "../../lib/uiCopy";
import { PersonaPicker } from "../PersonaPicker";
import { useSession } from "../session";

type TranscriptTurn = {
  ordinal: number;
  speaker: string;
  text: string;
};

type ChatGetResponse = {
  persona: PublishedPersona;
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
  const copy = loadUiCopy();
  const { loadingLabel } = loadNavConfig();
  const me = session.status === "ready" ? session.me : null;
  const [boot, setBoot] = useState<"loading" | "ready">("loading");
  const [banner, setBanner] = useState<Banner | null>(null);
  const [directory, setDirectory] = useState<PublishedPersona[]>([]);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [sittingLoad, setSittingLoad] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const picked = directory.find((row) => row.id === pickedId) ?? null;
  const pickerLocked = busy || sittingLoad;

  const applySession = useCallback(
    (userId: string, personaId: string, next: string) => {
      setSessionId(next);
      writeStoredChatSessionId(userId, personaId, next);
    },
    [],
  );

  useEffect(() => {
    if (!me) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const payload = await api<{ personas?: unknown }>("/api/personas");
        if (!cancelled) {
          setDirectory(parsePublishedDirectory(payload));
        }
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
    bottom.current?.scrollIntoView?.({ block: "end" });
  }, [turns, busy]);

  async function loadSitting(userId: string, personaId: string) {
    const stored = readStoredChatSessionId(userId, personaId);
    if (!stored) {
      setSessionId(null);
      setTurns([]);
      return;
    }
    try {
      const history = await api<ChatGetResponse>(
        `/api/chat?session_id=${encodeURIComponent(stored)}`,
      );
      if (history.persona.id !== personaId) {
        clearStoredChatSessionId(userId, personaId);
        setSessionId(null);
        setTurns([]);
        return;
      }
      setTurns(history.turns);
      applySession(userId, personaId, stored);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        clearStoredChatSessionId(userId, personaId);
        setSessionId(null);
        setTurns([]);
        return;
      }
      setBanner({ tone: "error", text: errorMessage(error) });
    }
  }

  async function pickPersona(id: string) {
    if (!me || id === pickedId || pickerLocked) {
      return;
    }
    setPickedId(id);
    setBanner(null);
    setDraft("");
    setTurns([]);
    setSessionId(null);
    setSittingLoad(true);
    try {
      await loadSitting(me.id, id);
    } finally {
      setSittingLoad(false);
    }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!me || !picked || !text || busy || sittingLoad) {
      return;
    }
    setBusy(true);
    setBanner(null);
    setDraft("");
    try {
      const payload: Record<string, string> = { text };
      if (sessionId) {
        payload.session_id = sessionId;
      } else {
        payload[personaPinField()] = picked.id;
      }
      const result = await api<ChatPostResponse>("/api/chat", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      applySession(me.id, picked.id, result.session_id);
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
    if (!me || !picked || pickerLocked) {
      return;
    }
    clearStoredChatSessionId(me.id, picked.id);
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

  const canTalk = Boolean(picked);
  const userSpeaker = turnSpeakerUser();

  return (
    <div style={wrapStyle}>
        <div style={headStyle}>
          <div>
            <h1 className="mc-pagehead__title">
              {picked?.display_name ?? copy.personaPickerTitle}
            </h1>
            <p style={{ color: "var(--text-mid)", marginTop: 6 }}>
              {picked?.handle ? `@${picked.handle}` : copy.personaPickerChatHelp}
            </p>
          </div>
          <Button type="button" onClick={startFresh} disabled={pickerLocked || !picked}>
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

        <PersonaPicker
          directory={directory}
          pickedId={pickedId}
          locked={pickerLocked}
          title={copy.personaPickerTitle}
          empty={copy.personaPickerEmpty}
          help={copy.personaPickerChatHelp}
          onPick={(id) => {
            void pickPersona(id);
          }}
        />

        <Card>
          <div style={{ display: "grid", gap: 10, minHeight: 280 }}>
            {turns.length === 0 && !busy && !sittingLoad && (
              <p style={{ color: "var(--text-mid)" }}>
                {picked ? copy.personaChatReady : copy.personaNeedPick}
              </p>
            )}
            {turns.map((turn) => (
              <div key={turn.ordinal} style={bubbleStyle(turn.speaker, userSpeaker)}>
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
              disabled={busy || sittingLoad || !canTalk}
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
                disabled={busy || sittingLoad || !canTalk || draft.trim().length === 0}
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
