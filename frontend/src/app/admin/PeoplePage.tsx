import { useCallback, useEffect, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { loadNavConfig } from "../../lib/nav";
import { navigate } from "../../lib/router";
import { ROUTES } from "../../lib/routes";
import { fetchOwnerUsers, type InsightsUser } from "../../lib/insights";
import { formatDateTime } from "../../lib/format";
import { loadUiCopy } from "../../lib/uiCopy";
import { FetchError } from "../dashboard/FetchState";

export function PeoplePage() {
  const nav = loadNavConfig();
  const copy = loadUiCopy();
  const title =
    nav.adminItems.find((item) => item.to === ROUTES.adminPeople)?.label ??
    copy.peopleTitle;
  const [rows, setRows] = useState<InsightsUser[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (nextCursor?: string) => {
    setLoading(true);
    setError(null);
    try {
      const page = await fetchOwnerUsers(nextCursor);
      setRows((current) =>
        nextCursor ? [...current, ...page.users] : page.users,
      );
      setCursor(page.next_cursor);
    } catch (caught) {
      setError(caught);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mc-wrap">
      <div className="mc-pagehead">
        <div>
          <h1 className="mc-pagehead__title">{title}</h1>
        </div>
      </div>
      <p style={{ color: "var(--text-mid)", marginBottom: 16 }}>
        {copy.subscriptionNote}
      </p>
      {error ? <FetchError error={error} onRetry={() => void load()} /> : null}
      {!error && rows.length === 0 && !loading ? (
        <Card>
          <p style={{ color: "var(--text-mid)" }}>{copy.emptyList}</p>
        </Card>
      ) : null}
      {!error
        ? rows.map((row) => (
            <button
              key={row.id}
              type="button"
              className="mc-activity__row"
              style={{
                width: "100%",
                textAlign: "left",
                background: "transparent",
                border: 0,
                color: "inherit",
                cursor: "pointer",
                padding: "10px 0",
              }}
              onClick={() =>
                navigate(
                  `${ROUTES.adminConversations}?user_id=${encodeURIComponent(row.id)}`,
                )
              }
            >
              <span className="mc-activity__rail">
                <span className="mc-activity__dot" />
              </span>
              <div className="mc-activity__main">
                <div className="mc-activity__title">{row.email}</div>
                <span className="mc-tag">
                  {row.subscription_status ?? copy.subscriptionNone} ·{" "}
                  {row.session_count}
                </span>
              </div>
              <span className="mc-activity__time">
                {formatDateTime(row.last_seen_at)}
              </span>
            </button>
          ))
        : null}
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
