import { useState } from "react";

export interface CompositionSlice {
  label: string;
  pct: number;
  fill: string;
}

export function MemoryComposition({ data }: { data: CompositionSlice[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  let offset = 0;
  const slices = data.map((slice) => {
    const centre = offset + slice.pct / 2;
    offset += slice.pct;
    return { ...slice, centre };
  });

  return (
    <div>
      <div className={"oc-comp" + (hovered !== null ? " is-hovering" : "")}>
        {slices.map((slice, i) => (
          <div
            key={slice.label}
            className={"oc-comp__seg" + (hovered === i ? " is-on" : "")}
            style={{ flexBasis: `${slice.pct}%`, background: slice.fill }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            {hovered === i && (
              <div className="oc-ctip oc-ctip--comp" style={{ left: `${slice.centre}%` }}>
                <div className="oc-ctip__v">{slice.pct}%</div>
                <div className="oc-ctip__l">{slice.label}</div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="oc-legend" style={{ marginTop: 16 }}>
        {data.map((slice) => (
          <span key={slice.label} className="oc-legend__item">
            <span className="oc-legend__sw" style={{ background: slice.fill }} />{slice.label} · {slice.pct}%
          </span>
        ))}
      </div>
    </div>
  );
}
