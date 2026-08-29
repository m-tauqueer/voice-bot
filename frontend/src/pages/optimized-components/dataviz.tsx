import { useMemo } from "react";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import { NodeSparkline } from "../../components/viz";
import { MemoryIcon } from "../../lib/memory-icons";

const VITALS = [
  { label: "Total Memories", value: "48,210", delta: "+1,204", data: [30, 32, 31, 35, 38, 42, 41, 46, 48] },
  { label: "Sources Connected", value: "9", delta: "+1", data: [4, 4, 5, 6, 6, 7, 8, 8, 9] },
  { label: "Queries Today", value: "312", delta: "+18%", data: [120, 180, 150, 210, 240, 230, 280, 300, 312] },
  { label: "Recall Rate", value: "92%", delta: "+2.4", data: [82, 84, 83, 86, 88, 87, 90, 91, 92], accent: true },
];

export function VitalsGrid() {
  return (
    <div className="oc-vitals">
      {VITALS.map((vital) => (
        <Card key={vital.label} variant="glass" className={"oc-tile" + (vital.accent ? " oc-tile--accent" : "")}>
          <div className="oc-tile__label">{vital.label}</div>
          <div className="oc-tile__row">
            <span className="oc-tile__num">{vital.value}</span>
            <Badge tone="positive">{vital.delta}</Badge>
          </div>
          <div className="oc-tile__spark">
            <NodeSparkline data={vital.data} accent={vital.accent} h={46} tone="fine" />
          </div>
        </Card>
      ))}
    </div>
  );
}

const GRAPH_SOURCES = [
  { label: "Notion", icon: "note" },
  { label: "Drive", icon: "folder" },
  { label: "Slack", icon: "chat" },
  { label: "Gmail", icon: "bell" },
  { label: "Web", icon: "globe" },
  { label: "PDFs", icon: "document" },
  { label: "Linear", icon: "dashboard" },
  { label: "GitHub", icon: "api" },
  { label: "Calendar", icon: "calendar" },
  { label: "Figma", icon: "embed" },
];

const GRAPH_CHORDS: [number, number][] = [[0, 5], [2, 3], [6, 7], [1, 4], [8, 9]];

const GRAPH_SIZE = 380;
const ORBIT_RADIUS = 138;
const NODE_RADIUS = 20;
const HUB_RADIUS = 30;

export function SourceGraph() {
  const centre = GRAPH_SIZE / 2;

  const nodes = useMemo(
    () => GRAPH_SOURCES.map((source, i) => {
      const angle = -Math.PI / 2 + (i / GRAPH_SOURCES.length) * Math.PI * 2;
      return {
        ...source,
        x: centre + ORBIT_RADIUS * Math.cos(angle),
        y: centre + ORBIT_RADIUS * Math.sin(angle),
      };
    }),
    [centre],
  );

  return (
    <div className="oc-graph">
      <svg width={GRAPH_SIZE} height={GRAPH_SIZE} viewBox={`0 0 ${GRAPH_SIZE} ${GRAPH_SIZE}`} className="oc-graph__svg">
        <circle cx={centre} cy={centre} r={HUB_RADIUS * 2.1} fill="rgba(255,107,62,.1)" />
        <circle cx={centre} cy={centre} r={HUB_RADIUS * 1.45} fill="rgba(255,107,62,.08)" />

        {GRAPH_CHORDS.map(([a, b], i) => (
          <line
            key={"chord" + i}
            x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y}
            stroke="rgba(255,255,255,.07)" strokeWidth={1}
          />
        ))}

        {nodes.map((node, i) => (
          <line
            key={"spoke" + i}
            className="oc-gspoke"
            x1={node.x} y1={node.y} x2={centre} y2={centre}
            stroke="rgba(255,255,255,.22)" strokeWidth={1.3}
          />
        ))}

        {nodes.map((node, i) => (
          <g key={"node" + i} className="oc-gnode">
            <circle cx={node.x} cy={node.y} r={NODE_RADIUS} fill="rgba(20,20,24,.7)" stroke="rgba(255,255,255,.2)" strokeWidth={1.4} />
            <g className="oc-gnode__ic" transform={`translate(${node.x - 10},${node.y - 10})`}>
              <MemoryIcon name={node.icon} size={20} weight={1.6} />
            </g>
            <text
              x={node.x}
              y={node.y + NODE_RADIUS + 13}
              textAnchor="middle"
              style={{ fontFamily: "var(--font-ui)", fontSize: 10, fontWeight: 500, fill: "rgba(255,255,255,.48)" }}
            >
              {node.label}
            </text>
          </g>
        ))}

        <circle cx={centre} cy={centre} r={HUB_RADIUS} fill="rgba(12,12,14,.97)" stroke="rgba(255,107,62,.6)" strokeWidth={1.6} />
        <g transform={`translate(${centre - 16},${centre - 16})`} style={{ color: "#ff9c7a" }}>
          <MemoryIcon name="logo-mark" size={32} weight={1.8} />
        </g>
      </svg>
    </div>
  );
}

const TIMELINE = [
  {
    group: "Today",
    items: [
      { title: "Ingested 3 PDFs from Drive", meta: "Drive", time: "2m", hot: true },
      { title: "Linked “OAuth flow” ↔ “Auth service”", meta: "graph", time: "14m", hot: false },
      { title: "Reinforced memory “pricing-v3”", meta: "recall", time: "1h", hot: false },
    ],
  },
  {
    group: "Yesterday",
    items: [
      { title: "Synced 48 Slack threads", meta: "Slack", time: "18h", hot: false },
      { title: "Embedded 12 web clips", meta: "Web", time: "21h", hot: false },
    ],
  },
];

export function MemoryTimeline() {
  return (
    <div className="oc-tl">
      {TIMELINE.map((group) => (
        <div key={group.group}>
          <div className="oc-tl__group">{group.group}</div>
          {group.items.map((item, i) => {
            const isLastOverall = group.group === "Yesterday" && i === group.items.length - 1;
            return (
              <div className="oc-tl__row" key={item.title}>
                <span className="oc-tl__rail">
                  <span className={"oc-tl__dot" + (item.hot ? " oc-tl__dot--hot" : "")} />
                  {!isLastOverall && <span className="oc-tl__line" />}
                </span>
                <div>
                  <div className="oc-tl__title">{item.title}</div>
                  <div className="oc-tl__meta"><span className="tagchip">{item.meta}</span></div>
                </div>
                <span className="oc-tl__time">{item.time}</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export const COMPOSITION = [
  { label: "Docs", pct: 42, fill: "rgba(255,255,255,.92)" },
  { label: "Conversations", pct: 28, fill: "rgba(255,255,255,.6)" },
  { label: "Web Clips", pct: 18, fill: "rgba(255,255,255,.4)" },
  { label: "Notes", pct: 12, fill: "var(--accent)" },
];

const SOURCE_HEALTH = [
  { icon: "note", name: "Notion", sub: "synced 4m ago · 1,204 items", status: "Healthy", state: "ok" as const },
  { icon: "chat", name: "Slack", sub: "syncing… · 3,201 items", status: "Syncing", state: "sync" as const },
  { icon: "folder", name: "Google Drive", sub: "synced 1h ago · 842 items", status: "Healthy", state: "ok" as const },
  { icon: "globe", name: "Web Clipper", sub: "reconnect needed", status: "Failed", state: "fail" as const },
];

const STATE_DOT = {
  ok: "rgba(255,255,255,.8)",
  sync: "var(--accent)",
  fail: "var(--color-error)",
};

function Spinner({ size = 16 }: { size?: number }) {
  return <span className="oc-spinner" style={{ width: size, height: size }} role="status" aria-label="syncing" />;
}

export function SourceHealthRows() {
  return (
    <div className="oc-src">
      {SOURCE_HEALTH.map((source) => (
        <div className="oc-src__row" key={source.name}>
          <span className="oc-src__glyph"><MemoryIcon name={source.icon} size={18} weight={1.7} /></span>
          <div style={{ minWidth: 0 }}>
            <div className="oc-src__name">{source.name}</div>
            <div className="oc-src__sub">{source.sub}</div>
          </div>
          <span className="oc-src__status">
            {source.state === "sync" && <Spinner size={14} />}
            <span
              className={"oc-src__dot" + (source.state === "sync" ? " oc-src__dot--pulse" : "")}
              style={{ background: STATE_DOT[source.state] }}
            />
            {source.status}
          </span>
        </div>
      ))}
    </div>
  );
}
