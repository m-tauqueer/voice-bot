import { MemoryIcon } from "../../lib/memory-icons";
import { Badge } from "../../components/ui/Badge";
import { ArrowUpRight } from "../../components/icons";
import { useCornerNotch } from "../../components/useCornerNotch";
import { NodeSparkline } from "../../components/viz";
import { KPIS } from "../data";
import type { Kpi } from "../data";

const NOTCH = [{ cxR: 33, cy: 27, r: 21 }];
const NOTCH_SWEEP = { sweep: 30 };
const RISE_STAGGER_MS = 60;

function KpiTile({ kpi, index }: { kpi: Kpi; index: number }) {
  const ref = useCornerNotch(NOTCH, NOTCH_SWEEP);

  return (
    <div className="mc-kpi-wrap mc-rise" style={{ animationDelay: `${index * RISE_STAGGER_MS}ms` }}>
      <div className="mc-kpi" ref={ref}>
        <div className="mc-kpi__top">
          <span className={"mc-kpi__glyph" + (kpi.accent ? " is-accent" : "")}>
            <MemoryIcon name={kpi.icon} size={17} weight={1.8} />
          </span>
          <span className="mc-kpi__label">{kpi.label}</span>
        </div>

        <div className="mc-kpi__row">
          <span className="mc-kpi__num">{kpi.value}</span>
          <Badge tone={kpi.accent ? "accent" : "positive"}>{kpi.delta}</Badge>
        </div>

        <div className="mc-kpi__caption">{kpi.caption}</div>
        <div className="mc-kpi__spark"><NodeSparkline data={kpi.data} accent={kpi.accent} h={42} /></div>
      </div>

      <button className="float float--arrow" aria-label={`Open ${kpi.label}`}><ArrowUpRight size={16} /></button>
    </div>
  );
}

export function KpiStrip() {
  return (
    <div className="mc-kpis">
      {KPIS.map((kpi, index) => <KpiTile key={kpi.id} kpi={kpi} index={index} />)}
    </div>
  );
}
