import { useMemo } from "react";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import { ActivityGraph } from "../../components/viz";
import { ACTIVITY_SERIES } from "../data";
import type { ActivityRangeId } from "../data";

export function MemoryActivity({ range }: { range: ActivityRangeId }) {
  const series = ACTIVITY_SERIES[range];

  const points = useMemo(
    () => series.recalls.map((recalls, i) => ({
      label: series.labels[i],
      tick: series.ticks[i],
      primary: recalls,
      secondary: series.captures[i],
    })),
    [series],
  );

  const recallTotal = useMemo(
    () => series.recalls.reduce((total, value) => total + value, 0),
    [series],
  );

  return (
    <Card variant="glass" className="mc-graphcard">
      <div className="mc-graphcard__head">
        <div className="mc-graphcard__stat">
          <span className="mc-graphcard__num">{recallTotal.toLocaleString()}</span>
          <Badge tone="positive">{series.delta}</Badge>
          <span className="mc-graphcard__caption">recalls {series.vs}</span>
        </div>
        <div className="mc-graphcard__legend">
          <span className="mc-graphcard__key"><i className="mc-graphcard__sw" />Recalls</span>
          <span className="mc-graphcard__key"><i className="mc-graphcard__sw mc-graphcard__sw--sec" />Captures</span>
        </div>
      </div>

      <ActivityGraph points={points} primaryLabel="Recalls" secondaryLabel="Captures" height={280} />
    </Card>
  );
}
