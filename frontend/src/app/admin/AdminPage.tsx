import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input, Textarea } from "../../components/ui/Input";
import Grainient from "../../components/Grainient";
import { ApiError, api, googleSignInUrl, logoutUrl } from "../../lib/gateway";

type Me = {
  id: string;
  email: string;
  engram_user_id: string;
  owner: boolean;
};

type Persona = {
  id: string;
  engram_persona_id: string;
  handle: string;
  display_name: string;
  description: string | null;
  voice_config: Record<string, unknown>;
};

type ShowResponse = {
  persona: Persona | null;
  engram: Record<string, unknown> | null;
  subscriptions: Array<{
    status: string;
    email: string;
    engram_user_id: string;
  }>;
};

type QuestionsResponse = {
  questions: unknown[];
  coverage: unknown;
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

function questionKey(item: unknown): string | null {
  if (!item || typeof item !== "object") {
    return typeof item === "string" ? item : null;
  }
  const record = item as Record<string, unknown>;
  const candidates = [record.question_key, record.key, record.id];
  for (const value of candidates) {
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return null;
}

function questionLabel(item: unknown): string {
  if (typeof item === "string") {
    return item;
  }
  if (item && typeof item === "object") {
    const record = item as Record<string, unknown>;
    const candidates = [record.text, record.prompt, record.question, record.label];
    for (const value of candidates) {
      if (typeof value === "string" && value.length > 0) {
        return value;
      }
    }
    return JSON.stringify(item);
  }
  return JSON.stringify(item);
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "request failed";
}

export function AdminPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [boot, setBoot] = useState<"loading" | "signed_out" | "ready">("loading");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [engramPersonaId, setEngramPersonaId] = useState("");
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [voiceConfig, setVoiceConfig] = useState("{}");
  const [subscriptions, setSubscriptions] = useState<ShowResponse["subscriptions"]>([]);

  const [teachText, setTeachText] = useState("");
  const [questions, setQuestions] = useState<unknown[]>([]);
  const [coverage, setCoverage] = useState<unknown>(null);
  const [answerKey, setAnswerKey] = useState("");
  const [answerText, setAnswerText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [subscribeUser, setSubscribeUser] = useState("");

  const loadPersona = useCallback(async () => {
    const shown = await api<ShowResponse>("/api/admin/persona");
    if (shown.persona) {
      setEngramPersonaId(shown.persona.engram_persona_id);
      setHandle(shown.persona.handle);
      setDisplayName(shown.persona.display_name);
      setDescription(shown.persona.description ?? "");
      setVoiceConfig(JSON.stringify(shown.persona.voice_config ?? {}, null, 2));
    }
    setSubscriptions(shown.subscriptions ?? []);
    return shown;
  }, []);

  const loadQuestions = useCallback(async () => {
    const payload = await api<QuestionsResponse>("/api/admin/questions");
    setQuestions(payload.questions ?? []);
    setCoverage(payload.coverage);
    return payload;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const identity = await api<Me>("/api/me");
        if (cancelled) return;
        setMe(identity);
        if (!identity.owner) {
          setBoot("ready");
          return;
        }
        try {
          await loadPersona();
        } catch (error) {
          if (!(error instanceof ApiError && error.status === 404)) {
            setStatus(errorMessage(error));
          }
        }
        try {
          await loadQuestions();
        } catch {
          // questions require a recorded persona
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
  }, [loadPersona, loadQuestions]);

  async function run(label: string, op: () => Promise<void>) {
    setBusy(label);
    setStatus(null);
    try {
      await op();
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  function parseVoiceConfig(): Record<string, unknown> {
    const parsed = JSON.parse(voiceConfig) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("voice_config must be a JSON object");
    }
    return parsed as Record<string, unknown>;
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
              Persona admin
            </h1>
            <p style={{ color: "var(--text-mid)", marginBottom: 18 }}>
              Sign in with Google to manage the persona.
            </p>
            {status && <p className="ui-field__error">{status}</p>}
            <Button variant="solid" onClick={() => { window.location.href = googleSignInUrl(); }}>
              Continue with Google
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  if (!me?.owner) {
    return (
      <div style={pageStyle}>
        <Grainient color3="#202028" saturation={0.7} />
        <div style={wrapStyle}>
          <Card>
            <h1 className="mc-pagehead__title" style={{ marginBottom: 8 }}>
              Persona admin
            </h1>
            <p style={{ color: "var(--text-mid)" }}>
              Signed in as {me?.email}. This account is not an owner.
            </p>
            <div style={{ marginTop: 16 }}>
              <Button onClick={() => { window.location.href = logoutUrl(); }}>Sign out</Button>
            </div>
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
            <h1 className="mc-pagehead__title">Persona admin</h1>
            <p style={{ color: "var(--text-mid)", marginTop: 6 }}>{me.email}</p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Badge tone="accent">Owner</Badge>
            <Button onClick={() => { window.location.href = logoutUrl(); }}>Sign out</Button>
          </div>
        </div>

        {status && (
          <Card>
            <p className="ui-field__error">{status}</p>
          </Card>
        )}

        <Card>
          <h2 className="mc-sec__title" style={{ marginBottom: 14 }}>
            Record persona
          </h2>
          <p style={{ color: "var(--text-mid)", marginBottom: 16 }}>
            Create the persona in the Engram dashboard, then record its id here.
          </p>
          <div style={{ display: "grid", gap: 12 }}>
            <Input
              label="Engram persona id"
              value={engramPersonaId}
              onChange={(event) => setEngramPersonaId(event.target.value)}
            />
            <Input label="Handle" value={handle} onChange={(event) => setHandle(event.target.value)} />
            <Input
              label="Display name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
            <Textarea
              label="Description"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <Textarea
              label="Voice config (JSON)"
              rows={6}
              value={voiceConfig}
              onChange={(event) => setVoiceConfig(event.target.value)}
            />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Button
                variant="solid"
                disabled={busy !== null}
                onClick={() =>
                  run("save", async () => {
                    await api("/api/admin/persona", {
                      method: "PUT",
                      body: JSON.stringify({
                        engram_persona_id: engramPersonaId || undefined,
                        handle: handle || undefined,
                        display_name: displayName || undefined,
                        description,
                        voice_config: parseVoiceConfig(),
                      }),
                    });
                    await loadPersona();
                    setStatus("Persona saved.");
                  })
                }
              >
                {busy === "save" ? "Saving…" : "Save persona"}
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="mc-sec__title" style={{ marginBottom: 14 }}>
            Teach
          </h2>
          <Textarea
            label="Fact"
            rows={4}
            value={teachText}
            onChange={(event) => setTeachText(event.target.value)}
          />
          <div style={{ marginTop: 12 }}>
            <Button
              disabled={busy !== null}
              onClick={() =>
                run("teach", async () => {
                  await api("/api/admin/teach", {
                    method: "POST",
                    body: JSON.stringify({ text: teachText }),
                  });
                  setTeachText("");
                  setStatus("Fact taught.");
                })
              }
            >
              {busy === "teach" ? "Teaching…" : "Teach fact"}
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className="mc-sec__title" style={{ marginBottom: 8 }}>
            Question bank
          </h2>
          <p style={{ color: "var(--text-mid)", marginBottom: 12 }}>
            Coverage: {coverage === null || coverage === undefined ? "—" : String(coverage)}
          </p>
          {questions.length === 0 ? (
            <p style={{ color: "var(--text-mid)", marginBottom: 12 }}>
              No open questions. Answer by key if you have one.
            </p>
          ) : (
            <ul style={{ margin: "0 0 16px", paddingLeft: 18, color: "var(--text-mid)" }}>
              {questions.map((item, index) => (
                <li key={questionKey(item) ?? String(index)} style={{ marginBottom: 8 }}>
                  <button
                    type="button"
                    className="ui-btn ui-btn--ghost ui-btn--sm"
                    onClick={() => {
                      const key = questionKey(item);
                      if (key) setAnswerKey(key);
                    }}
                  >
                    Use key
                  </button>{" "}
                  {questionLabel(item)}
                </li>
              ))}
            </ul>
          )}
          <div style={{ display: "grid", gap: 12 }}>
            <Input
              label="Question key"
              value={answerKey}
              onChange={(event) => setAnswerKey(event.target.value)}
            />
            <Textarea
              label="Answer"
              rows={3}
              value={answerText}
              onChange={(event) => setAnswerText(event.target.value)}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <Button
                disabled={busy !== null}
                onClick={() =>
                  run("questions", async () => {
                    await loadQuestions();
                    setStatus("Questions refreshed.");
                  })
                }
              >
                Refresh
              </Button>
              <Button
                variant="solid"
                disabled={busy !== null}
                onClick={() =>
                  run("answer", async () => {
                    await api("/api/admin/answer", {
                      method: "POST",
                      body: JSON.stringify({ question_key: answerKey, text: answerText }),
                    });
                    setAnswerText("");
                    await loadQuestions();
                    setStatus("Answer saved.");
                  })
                }
              >
                {busy === "answer" ? "Saving…" : "Save answer"}
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="mc-sec__title" style={{ marginBottom: 14 }}>
            Shared document
          </h2>
          <input
            type="file"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <div style={{ marginTop: 12 }}>
            <Button
              disabled={busy !== null || !file}
              onClick={() =>
                run("ingest", async () => {
                  if (!file) return;
                  const body = new FormData();
                  body.append("file", file);
                  await api("/api/admin/ingest", { method: "POST", body });
                  setStatus("Document ingested.");
                })
              }
            >
              {busy === "ingest" ? "Ingesting…" : "Ingest document"}
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className="mc-sec__title" style={{ marginBottom: 14 }}>
            Subscribe tester
          </h2>
          <Input
            label="Email or user id"
            value={subscribeUser}
            onChange={(event) => setSubscribeUser(event.target.value)}
          />
          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
            <Button
              variant="solid"
              disabled={busy !== null}
              onClick={() =>
                run("subscribe", async () => {
                  await api("/api/admin/subscribe", {
                    method: "POST",
                    body: JSON.stringify({ user: subscribeUser }),
                  });
                  await loadPersona();
                  setStatus("Tester subscribed.");
                })
              }
            >
              {busy === "subscribe" ? "Subscribing…" : "Subscribe in Engram"}
            </Button>
            <Button
              disabled={busy !== null}
              onClick={() =>
                run("record", async () => {
                  await api("/api/admin/subscribe", {
                    method: "POST",
                    body: JSON.stringify({ user: subscribeUser, record_local: true }),
                  });
                  await loadPersona();
                  setStatus("Local subscription recorded.");
                })
              }
            >
              Record local only
            </Button>
          </div>
          {subscriptions.length > 0 && (
            <ul style={{ marginTop: 16, paddingLeft: 18, color: "var(--text-mid)" }}>
              {subscriptions.map((row) => (
                <li key={row.engram_user_id}>
                  {row.email} · {row.status}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
