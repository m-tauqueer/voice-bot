import { useCallback, useEffect, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Section } from "../../components/Section";
import { loadNavConfig } from "../../lib/nav";
import { matchPattern, navigate, useRoute } from "../../lib/router";
import { dashboardSessionPath, PATTERNS, ROUTES } from "../../lib/routes";
import {
  fetchPersonalSession,
  fetchPersonalSessions,
  type SessionDetail,
  type SessionListItem,
} from "../../lib/insights";
import { loadUiCopy } from "../../lib/uiCopy";
import { useSession } from "../session";
import { FetchError } from "./FetchState";
import { MemoryPanel } from "./MemoryPanel";
import { SessionRows } from "./SessionRows";
import { SpokenTranscript } from "./Transcripts";

export function PersonalHome() {
  const path = useRoute();
  const params = matchPattern(path, PATTERNS.dashboardSession);
  if (params?.id) {
    return <PersonalSession id={params.id} />;
  }
  return <PersonalIndex />;
}

function PersonalIndex() {
  const session = useSession();
  const nav = loadNavConfig();
  const copy = loadUiCopy();
  const personaName =
    session.status === "ready" && session.persona
      ? session.persona.display_name
      : nav.appName;
  const [rows, setRows] = useState<SessionListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (nextCursor?: string) => {
    setLoading(true);
    setError(null);
    try {
      const page = await fetchPersonalSessions({
        range: copy.defaultRange,
        cursor: nextCursor,
      });
      setRows((current) =>
        nextCursor ? [...current, ...page.sessions] : page.sessions,
      );
      setCursor(page.next_cursor);
    } catch (caught) {
      setError(caught);
    } finally {
      setLoading(false);
    }
  }, [copy.defaultRange]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mc-wrap">
      <div className="mc-pagehead">
        <div>
          <h1 className="mc-pagehead__title">{personaName}</h1>
        </div>
      </div>
      <Section title={copy.recentTitle} first>
        {error ? <FetchError error={error} onRetry={() => void load()} /> : null}
        {!error ? (
          <SessionRows
            sessions={rows}
            showUser={false}
            hrefFor={(row) => dashboardSessionPath(row.id)}
          />
        ) : null}
        {cursor ? (
          <div style={{ marginTop: 16 }}>
            <Button type="button" disabled={loading} onClick={() => void load(cursor)}>
              {copy.loadMore}
            </Button>
          </div>
        ) : null}
      </Section>
      <MemoryPanel />
    </div>
  );
}

function PersonalSession({ id }: { id: string }) {
  const nav = loadNavConfig();
  const copy = loadUiCopy();
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setDetail(await fetchPersonalSession(id));
    } catch (caught) {
      setDetail(null);
      setError(caught);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mc-wrap">
      <div className="mc-pagehead">
        <div>
          <h1 className="mc-pagehead__title">{copy.recentTitle}</h1>
        </div>
        <Button type="button" onClick={() => navigate(ROUTES.dashboard)}>
          {copy.backLabel}
        </Button>
      </div>
      {error ? <FetchError error={error} onRetry={() => void load()} /> : null}
      {!error && !detail ? <p>{nav.loadingLabel}</p> : null}
      {detail ? <SpokenTranscript detail={detail} /> : null}
    </div>
  );
}
