import { useMemo, useState } from "react";

const COLS = 20;
const ROWS = 9;
const CELL = 12;
const GAP = 2.5;

const TOPICS = [
  "react-hooks", "auth-flow", "pricing", "onboarding", "api-design", "embeddings",
  "webhooks", "billing", "search", "caching", "rate-limits", "oauth",
  "schema", "vectors", "prompts", "retrieval", "indexing", "sync",
];

const HOTSPOTS: [col: number, row: number, amplitude: number][] = [
  [5, 3, 1], [10, 5, 0.85], [14, 2, 0.62], [9, 7, 0.7], [16, 6, 0.6], [3, 6, 0.5],
];

function hexPoints(cx: number, cy: number, size: number) {
  const vertices: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    vertices.push(`${(cx + size * Math.cos(angle)).toFixed(2)},${(cy + size * Math.sin(angle)).toFixed(2)}`);
  }
  return vertices.join(" ");
}

function pseudoRandom(col: number, row: number) {
  const noise = Math.sin(col * 12.9898 + row * 78.233) * 43758.5453;
  return noise - Math.floor(noise);
}

interface HeatCell {
  i: number;
  cx: number;
  cy: number;
  heat: number;
  topic: string;
  recalls: number;
}

function buildCells(): HeatCell[] {
  const hSpace = Math.sqrt(3) * CELL + GAP;
  const vSpace = 1.5 * CELL + GAP;
  const pad = CELL + 3;
  const cells: HeatCell[] = [];

  for (let i = 0; i < COLS * ROWS; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);

    let cx = pad + col * hSpace;
    const cy = pad + row * vSpace;
    if (row % 2 === 1) cx += hSpace / 2;

    let heat = 0;
    for (const [hotCol, hotRow, amplitude] of HOTSPOTS) {
      const distanceSq = (col - hotCol) ** 2 + ((row - hotRow) * 1.25) ** 2;
      heat = Math.max(heat, amplitude * Math.exp(-distanceSq / 8));
    }
    heat = Math.max(0, Math.min(1, heat * 0.82 + pseudoRandom(col, row) * 0.18));

    cells.push({ i, cx, cy, heat, topic: TOPICS[i % TOPICS.length], recalls: Math.round(heat * 42) + 1 });
  }

  return cells;
}

export function RecallHeatmap() {
  const cells = useMemo(buildCells, []);
  const hottest = useMemo(
    () => cells.reduce((best, cell) => (cell.heat > cells[best].heat ? cell.i : best), 0),
    [cells],
  );

  const width = Math.max(...cells.map((c) => c.cx)) + CELL + 3;
  const height = Math.max(...cells.map((c) => c.cy)) + CELL + 3;

  const [tip, setTip] = useState<{ x: number; y: number; topic: string; recalls: number } | null>(null);

  return (
    <div className="oc-heat">
      <div className="oc-heat__plot" onMouseLeave={() => setTip(null)}>
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
          {cells.map((cell) => (
            <polygon
              key={cell.i}
              className="oc-hex"
              points={hexPoints(cell.cx, cell.cy, CELL)}
              fill={cell.i === hottest ? "var(--accent)" : `rgba(255,255,255,${(0.07 + cell.heat * 0.82).toFixed(3)})`}
              stroke="rgba(255,255,255,.07)"
              strokeWidth={0.8}
              onMouseEnter={() => setTip({
                x: (cell.cx / width) * 100,
                y: (cell.cy / height) * 100,
                topic: cell.topic,
                recalls: cell.recalls,
              })}
            />
          ))}
        </svg>

        {tip && (
          <div className="oc-ctip" style={{ left: `${tip.x}%`, top: `${tip.y}%` }}>
            <div className="oc-ctip__v">{tip.recalls} recalls</div>
            <div className="oc-ctip__l">“{tip.topic}” · this week</div>
          </div>
        )}
      </div>
    </div>
  );
}

const LEGEND_STEPS = [
  { label: "cold", colour: "rgba(255,255,255,.1)" },
  { label: "warm", colour: "rgba(255,255,255,.45)" },
  { label: "hot", colour: "rgba(255,255,255,.85)" },
  { label: "hottest memory", colour: "var(--accent)" },
];

export function LegendScale() {
  return (
    <div className="oc-legend">
      {LEGEND_STEPS.map((step) => (
        <span key={step.label} className="oc-legend__item">
          <span className="oc-legend__sw" style={{ background: step.colour }} />
          {step.label}
        </span>
      ))}
      <div className="oc-legend__scale">
        <div className="oc-legend__bar" />
        <div className="oc-legend__ticks"><span>0 recalls</span><span>40+ / week</span></div>
      </div>
    </div>
  );
}
