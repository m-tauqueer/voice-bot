import { useCallback, useEffect, useState } from "react";
import { Card } from "../../components/ui/Card";
import { Section } from "../../components/Section";
import { ApiError } from "../../lib/gateway";
import { fetchPersonalMemories, type MemoryHit } from "../../lib/insights";
import { memoryPanelReloadKey } from "../../lib/memoryPanel";
import { loadUiCopy } from "../../lib/uiCopy";
import { EmptyNote } from "./FetchState";
import { useSession } from "../session";

export function MemoryPanel() {
  const copy = loadUiCopy();
  const session = useSession();
  const [hits, setHits] = useState<MemoryHit[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const userId = session.status === "ready" ? session.me.id : undefined;
  const personaId =
    session.status === "ready" ? session.persona?.id : undefined;
  const reloadKey = memoryPanelReloadKey(userId, session.status, personaId);

  const load = useCallback(async () => {
    if (session.status !== "ready") {
      return;
    }
    if (!copy.memoryEnabled) {
      setHits([]);
      return;
    }
    if (!personaId) {
      setHits([]);
      setUnavailable(false);
      return;
    }
    try {
      const panel = await fetchPersonalMemories(personaId);
      setHits(panel.memories);
      setUnavailable(false);
    } catch (error) {
      setHits([]);
      setUnavailable(!(error instanceof ApiError && error.status === 404));
    }
  }, [copy.memoryEnabled, personaId, reloadKey, session.status]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  if (!copy.memoryEnabled) {
    return null;
  }

  return (
    <Section title={copy.memoryTitle}>
      {unavailable ? <EmptyNote text={copy.memoryUnavailable} /> : null}
      {!unavailable && hits && hits.length === 0 ? (
        <EmptyNote text={copy.emptyMemory} />
      ) : null}
      {hits && hits.length > 0 ? (
        <div style={{ display: "grid", gap: 10 }}>
          {hits.map((hit, index) => (
            <Card key={`${index}:${hit.text.slice(0, 24)}`}>
              <p style={{ whiteSpace: "pre-wrap" }}>{hit.text}</p>
            </Card>
          ))}
        </div>
      ) : null}
    </Section>
  );
}
