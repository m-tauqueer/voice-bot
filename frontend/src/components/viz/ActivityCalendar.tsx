import { useMemo } from "react";

const DAYS_PER_WEEK = 7;
const RECENT_WEEKS = 6;
const WEEKEND_DIP = 0.25;

const INTENSITY_RAMP = [
  "rgba(255,255,255,.05)",
  "rgba(255,255,255,.18)",
  "rgba(255,255,255,.34)",
  "rgba(255,255,255,.6)",
  "var(--accent)",
];

function pseudoRandom(week: number, day: number) {
  const noise = Math.sin(week * 41.17 + day * 9.13) * 9973;
  return noise - Math.floor(noise);
}

function buildCells(weeks: number) {
  const cells: { level: number; count: number }[] = [];

  for (let week = 0; week < weeks; week++) {
    for (let day = 0; day < DAYS_PER_WEEK; day++) {
      const recentBoost = week > weeks - RECENT_WEEKS ? 0.25 : 0;
      const isWeekend = day === 0 || day === DAYS_PER_WEEK - 1;
      const intensity = Math.max(
        0,
        Math.min(1, pseudoRandom(week, day) * 0.9 + recentBoost - (isWeekend ? WEEKEND_DIP : 0)),
      );
      cells.push({ level: Math.round(intensity * 4), count: Math.round(intensity * 17) });
    }
  }

  return cells;
}

export function ActivityCalendar({ weeks = 26 }: { weeks?: number }) {
  const cells = useMemo(() => buildCells(weeks), [weeks]);

  return (
    <div className="oc-cal">
      <div className="oc-cal__grid" style={{ gridTemplateColumns: `repeat(${weeks}, 1fr)` }}>
        {Array.from({ length: weeks }).map((_, week) => (
          <div key={week} className="oc-cal__col">
            {Array.from({ length: DAYS_PER_WEEK }).map((__, day) => {
              const cell = cells[week * DAYS_PER_WEEK + day];
              return (
                <span
                  key={day}
                  className="oc-cal__cell"
                  style={{ background: INTENSITY_RAMP[cell.level] }}
                  title={`${cell.count} memories`}
                />
              );
            })}
          </div>
        ))}
      </div>

      <div className="oc-cal__foot">
        <span>{weeks} weeks</span>
        <span className="oc-cal__key">less {INTENSITY_RAMP.map((colour, i) => <i key={i} style={{ background: colour }} />)} more</span>
      </div>
    </div>
  );
}
