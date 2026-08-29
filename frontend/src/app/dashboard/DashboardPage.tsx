import { useState } from "react";
import { MemoryIcon } from "../../lib/memory-icons";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Segmented } from "../../components/ui/Segmented";
import { LegendScale, NodeRing, RecallHeatmap } from "../../components/viz";
import { AppShell } from "../shell/AppShell";
import { ACTIVITY_RANGE_CAPTIONS, CONNECTORS, CURRENT_USER } from "../data";
import type { ActivityRangeId } from "../data";
import { Composer } from "./Composer";
import { ConnectorList } from "./ConnectorList";
import { FeaturedMemory } from "./FeaturedMemory";
import { KpiStrip } from "./KpiStrip";
import { MemoryActivity } from "./MemoryActivity";
import { QuickActions } from "./QuickActions";
import { QuickCapture } from "./QuickCapture";
import { RecentActivity } from "./RecentActivity";
import { Section } from "./Section";

const RANGE_OPTIONS: { value: ActivityRangeId; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
];

const INTELLIGENCE_RINGS = [
  { percent: 94, value: "94%", title: "Index health" },
  { percent: 92, value: "92%", title: "Recall accuracy" },
  { percent: 87, value: "87%", title: "Embedding coverage", accent: true },
];

function WorkspaceContext() {
  return (
    <button className="mc-ctx">
      <span className="mc-ctx__dot" />
      All workspaces
      <span className="mc-ctx__chev"><MemoryIcon name="chevron-down" size={14} weight={2} /></span>
    </button>
  );
}

function PageHead() {
  const firstName = CURRENT_USER.name.split(" ")[0];

  return (
    <div className="mc-pagehead">
      <div>
        <div className="mc-eyebrow">Overview</div>
        <h1 className="mc-pagehead__title">Good morning, {firstName}.</h1>
        <p className="mc-pagehead__sub">
          Your second brain ingested 312 new items and reinforced 19 memories today.
        </p>
      </div>
      <div className="mc-pagehead__actions">
        <Button variant="ghost" icon={<MemoryIcon name="sliders" size={15} weight={1.8} />}>Customize</Button>
        <Button variant="glass" icon={<MemoryIcon name="download" size={15} weight={1.8} />}>Export</Button>
        <Button variant="solid" icon={<MemoryIcon name="plus" size={15} weight={2} />}>New memory</Button>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const [range, setRange] = useState<ActivityRangeId>("7d");

  return (
    <AppShell
      active="dashboard"
      topLeft={<WorkspaceContext />}
      topActions={<Segmented value={range} onChange={setRange} options={RANGE_OPTIONS} />}
    >
      <div className="mc-wrap mc-dash">
        <PageHead />
        <KpiStrip />

        <Section title="Memory activity" note={ACTIVITY_RANGE_CAPTIONS[range]}>
          <MemoryActivity range={range} />
        </Section>

        <div className="mc-dash__grid">
          <div className="mc-dash__col">
            <Section
              title="Quick actions"
              first
              action={<button className="mc-sec__link">View workspaces <MemoryIcon name="chevron-right" size={13} weight={2} /></button>}
            >
              <QuickActions />
            </Section>

            <Section title="Quick capture" note="3 items queued">
              <QuickCapture />
            </Section>

            <Section title="Memory intelligence" note="Last 7 days">
              <Card variant="glass" className="mc-rings">
                {INTELLIGENCE_RINGS.map((ring) => <NodeRing key={ring.title} {...ring} />)}
              </Card>
            </Section>

            <Section title="Recall heatmap" note="This week">
              <Card variant="glass">
                <RecallHeatmap />
                <div style={{ marginTop: 18 }}><LegendScale /></div>
              </Card>
            </Section>
          </div>

          <div className="mc-dash__col">
            <Section
              title="Connectors"
              count={CONNECTORS.length}
              first
              action={<button className="mc-sec__link">Manage</button>}
            >
              <ConnectorList />
            </Section>

            <Section
              title="Top memory"
              action={<button className="mc-sec__link">In Sales <MemoryIcon name="chevron-right" size={13} weight={2} /></button>}
            >
              <FeaturedMemory />
            </Section>

            <Section title="Recent activity" note="All">
              <RecentActivity />
            </Section>
          </div>
        </div>

        <div style={{ height: 8 }} />
      </div>

      <Composer />
    </AppShell>
  );
}
