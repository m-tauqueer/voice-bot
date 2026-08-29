import { useEffect, useState } from "react";

const SEGMENTS = 16;
const RING_INSET = 15;
const MODULE_EVERY = 4;
const FILL_DELAY_MS = 90;
const STAGGER_S = 0.028;
const DIM = "rgba(255,255,255,.13)";

export function NodeRing({ percent, value, title, accent = false, size = 132 }: {
  percent: number;
  value: string;
  title?: string;
  accent?: boolean;
  size?: number;
}) {
  const centre = size / 2;
  const radius = size / 2 - RING_INSET;
  const litCount = Math.round((Math.max(0, Math.min(100, percent)) / 100) * SEGMENTS);

  const [shown, setShown] = useState(0);
  useEffect(() => {
    const timer = window.setTimeout(() => setShown(litCount), FILL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [litCount]);

  const points = Array.from({ length: SEGMENTS }, (_, i) => {
    const angle = -Math.PI / 2 + (i / SEGMENTS) * Math.PI * 2;
    return {
      i,
      x: centre + radius * Math.cos(angle),
      y: centre + radius * Math.sin(angle),
      isModule: i % MODULE_EVERY === 0,
    };
  });

  const litColor = accent ? "var(--accent)" : "rgba(255,255,255,.92)";

  return (
    <div className="oc-ring">
      <div className="oc-ring__wrap" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {points.map((point, i) => {
            const next = points[(i + 1) % SEGMENTS];
            const on = i + 1 <= shown;
            return (
              <path
                key={"bridge" + i}
                d={`M ${point.x.toFixed(2)} ${point.y.toFixed(2)} A ${radius} ${radius} 0 0 1 ${next.x.toFixed(2)} ${next.y.toFixed(2)}`}
                fill="none"
                stroke={on ? litColor : DIM}
                strokeWidth={on ? 1.5 : 1}
                strokeOpacity={0.5}
                strokeLinecap="round"
                style={{ transition: "stroke .45s ease", transitionDelay: `${i * STAGGER_S}s` }}
              />
            );
          })}

          {points.map((point) => {
            const on = point.i < shown;
            const colour = on ? litColor : DIM;
            const transition = { transition: "fill .45s ease", transitionDelay: `${point.i * STAGGER_S}s` };

            return point.isModule ? (
              <rect
                key={"node" + point.i}
                x={point.x - 3.1}
                y={point.y - 3.1}
                width={6.2}
                height={6.2}
                rx={1.6}
                fill={colour}
                style={transition}
              />
            ) : (
              <circle
                key={"node" + point.i}
                cx={point.x}
                cy={point.y}
                r={on ? 3.1 : 2.6}
                fill={colour}
                style={transition}
              />
            );
          })}
        </svg>

        <div className="oc-ring__center"><span className="oc-ring__num">{value}</span></div>
      </div>

      {title && <span className="oc-ring__label">{title}</span>}
    </div>
  );
}
