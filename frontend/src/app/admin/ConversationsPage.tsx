import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Segmented } from "../../components/ui/Segmented";
import { loadNavConfig } from "../../lib/nav";
import {
  matchPattern,
  navigate,
  useRoute,
  useSearchParams,
} from "../../lib/router";
import { adminSessionPath, PATTERNS, ROUTES } from "../../lib/routes";
import {
  fetchOwnerSession,
  fetchOwnerSessions,
  type SessionDetail,
  type SessionListItem,
} from "../../lib/insights";
import { loadUiCopy } from "../../lib/uiCopy";
import { FetchError } from "../dashboard/FetchState";
import { SessionRows } from "../dashboard/SessionRows";
import { SessionReconstruct } from "../dashboard/Transcripts";

export function ConversationsPage() {
  const path = useRoute();
  const params = matchPattern(path, PATTERNS.adminSession);
  if (params?.id) {
    return <ConversationDetail id={params.id} />;
  }
  return <ConversationList />;
}

function ConversationList() {
  const nav = loadNavConfig();
  const copy = loadUiCopy();
  const search = useSearchParams();
  const range = search.get("range") ?? copy.defaultRange;
  const channelRaw = search.get("channel") ?? copy.filterAnyId;
  const userId = search.get("user_id") ?? "";
  const [rows, setRows] = useState<SessionListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  const title =
    nav.adminItems.find((item) => item.to === ROUTES.adminConversations)?.label ??
    copy.conversationsTitle;

  const channelParam = channelRaw === copy.filterAnyId ? undefined : channelRaw;

  const load = useCallback(
    async (nextCursor?: string) => {
      setLoading(true);
      setError(null);
      try {
        const page = await fetchOwnerSessions({
          range,
          cursor: nextCursor,
          channel: channelParam,
          userId: userId || undefined,
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
    },
    [channelParam, range, userId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const queryFor = (next: { range?: string; channel?: string }) => {
    const query = new URLSearchParams();
    query.set("range", next.range ?? range);
    query.set("channel", next.channel ?? channelRaw);
    if (userId) {
      query.set("user_id", userId);
    }
    return `${ROUTES.adminConversations}?${query.toString()}`;
  };

  return (
    <div className="mc-wrap">
      <div className="mc-pagehead">
        <div>
          <h1 className="mc-pagehead__title">{title}</h1>
        </div>
        <Segmented
          options={copy.ranges.map((item) => ({
            value: item.id,
            label: item.label,
          }))}
          value={range}
          onChange={(value) => navigate(queryFor({ range: value }))}
        />
      </div>
      <div style={{ marginBottom: 16 }}>
        <Segmented
          options={copy.channelFilters.map((item) => ({
            value: item.id,
            label: item.label,
          }))}
          value={channelRaw}
          onChange={(value) => navigate(queryFor({ channel: value }))}
        />
      </div>
      {error ? <FetchError error={error} onRetry={() => void load()} /> : null}
      {!error ? (
        <SessionRows
          sessions={rows}
          showUser
          hrefFor={(row) => adminSessionPath(row.id)}
        />
      ) : null}
      {cursor ? (
        <div style={{ marginTop: 16 }}>
          <Button type="button" disabled={loading} onClick={() => void load(cursor)}>
            {copy.loadMore}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ConversationDetail({ id }: { id: string }) {
  const nav = loadNavConfig();
  const copy = loadUiCopy();
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setDetail(await fetchOwnerSession(id));
    } catch (caught) {
      setDetail(null);
      setError(caught);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const heading = useMemo(
    () => detail?.user_email ?? copy.conversationsTitle,
    [copy.conversationsTitle, detail],
  );

  return (
    <div className="mc-wrap">
      <div className="mc-pagehead">
        <div>
          <h1 className="mc-pagehead__title">{heading}</h1>
        </div>
        <Button type="button" onClick={() => navigate(ROUTES.adminConversations)}>
          {copy.backLabel}
        </Button>
      </div>
      {error ? <FetchError error={error} onRetry={() => void load()} /> : null}
      {!error && !detail ? <p>{nav.loadingLabel}</p> : null}
      {detail ? <SessionReconstruct detail={detail} /> : null}
    </div>
  );
}
