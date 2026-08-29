import { useEffect, useRef, useState } from "react";
import { MemoryIcon } from "../lib/memory-icons";
import { Close, ArrowUpRight } from "./icons";
import { navigate } from "../lib/router";
import { ROUTES } from "../lib/routes";

interface DialSegment {
  icon: string;
  name: string;
  items: string[];
  to?: string;
}

const SEGMENTS: DialSegment[] = [
  { icon: "memory", name: "Memories", to: ROUTES.dashboard, items: ["All memories", "Recently added", "Top recalled", "Saved"] },
  { icon: "spaces", name: "Workspaces", items: ["Sales", "Product", "Engineering", "Design"] },
  { icon: "chat", name: "Chat", items: ["New chat", "Ask your second brain", "Recent threads"] },
  { icon: "connector", name: "Connectors", items: ["Slack", "Notion", "Google Drive", "Add a connector"] },
  { icon: "search", name: "Search", to: ROUTES.dashboard, items: ["Search memories", "Find people", "Browse tags"] },
  { icon: "upload", name: "Capture", to: ROUTES.dashboard, items: ["Add resource", "Web clip", "Paste a URL", "Infer notes"] },
  { icon: "users", name: "People", items: ["All people", "Teams", "Companies"] },
  { icon: "settings", name: "Settings", items: ["Preferences", "Members", "Billing"] },
];

const SEGMENT_COUNT = SEGMENTS.length;
const SEGMENT_STEP = 360 / SEGMENT_COUNT;
const ORBIT_RADIUS = 158;
const KNOB_RADIUS = 72;

const segmentAngle = (index: number) => -90 + index * SEGMENT_STEP;

function shortestStep(from: number, to: number) {
  const forward = (((to - from) % SEGMENT_COUNT) + SEGMENT_COUNT) % SEGMENT_COUNT;
  return forward > SEGMENT_COUNT / 2 ? forward - SEGMENT_COUNT : forward;
}

function nearestSegment(angleDeg: number, fallback: number) {
  let smallest = Infinity;
  let nearest = fallback;
  for (let i = 0; i < SEGMENT_COUNT; i++) {
    const delta = Math.abs(((angleDeg - segmentAngle(i) + 540) % 360) - 180);
    if (delta < smallest) {
      smallest = delta;
      nearest = i;
    }
  }
  return nearest;
}

export function RadialMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [active, setActive] = useState(1);
  const dialRef = useRef<HTMLDivElement>(null);

  const [rotation, setRotation] = useState(active * SEGMENT_STEP);
  const previousActive = useRef(active);

  useEffect(() => {
    const step = shortestStep(previousActive.current, active);
    previousActive.current = active;
    setRotation((current) => current + step * SEGMENT_STEP);
  }, [active]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowUp" || e.key === "ArrowLeft") setActive((i) => (i - 1 + SEGMENT_COUNT) % SEGMENT_COUNT);
      else if (e.key === "ArrowDown" || e.key === "ArrowRight") setActive((i) => (i + 1) % SEGMENT_COUNT);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const trackPointer = (e: React.PointerEvent) => {
    const el = dialRef.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const dx = e.clientX - (box.left + box.width / 2);
    const dy = e.clientY - (box.top + box.height / 2);
    if (Math.hypot(dx, dy) < KNOB_RADIUS) return;

    const next = nearestSegment((Math.atan2(dy, dx) * 180) / Math.PI, active);
    if (next !== active) setActive(next);
  };

  const segment = SEGMENTS[active];

  const followSegment = () => {
    if (!segment.to) return;
    navigate(segment.to);
    onClose();
  };

  return (
    <div className={"dial-overlay" + (open ? " is-open" : "")} onClick={onClose}>
      <button className="dial-close" onClick={onClose} aria-label="Close menu">
        <Close size={18} />
      </button>

      <div className="dial-stage" onClick={(e) => e.stopPropagation()}>
        <div className="dial" ref={dialRef} onPointerMove={trackPointer}>
          <div className="dial__ring" />
          <div className="dial__dividers" />
          <div className="dial__hi" style={{ transform: `rotate(${rotation}deg)` }} />

          {SEGMENTS.map((s, i) => {
            const radians = (segmentAngle(i) * Math.PI) / 180;
            const x = Math.cos(radians) * ORBIT_RADIUS;
            const y = Math.sin(radians) * ORBIT_RADIUS;
            return (
              <button
                key={s.name}
                className={"dial__seg" + (i === active ? " is-active" : "")}
                style={{
                  transform: `translate(${open ? x.toFixed(1) : 0}px, ${open ? y.toFixed(1) : 0}px) scale(${open ? 1 : 0})`,
                  transitionDelay: `${open ? i * 0.035 : 0}s`,
                }}
                onPointerEnter={() => setActive(i)}
                onClick={() => setActive(i)}
                aria-label={s.name}
              >
                <MemoryIcon name={s.icon} size={22} weight={1.7} />
              </button>
            );
          })}

          <div className="dial__knob" aria-hidden>
            <img src="/Logo-black.svg" alt="" width={64} height={64} />
          </div>
        </div>

        <div className="dial-flyout">
          <div className="dial-flyout__head">
            <MemoryIcon name={segment.icon} size={16} weight={1.8} />
            <span>{segment.name}</span>
          </div>
          <ul key={active} className="dial-flyout__list">
            {segment.items.map((label, i) => (
              <li
                key={label}
                className={"dial-flyout__item" + (i === 0 ? " is-active" : "")}
                style={{ animationDelay: `${0.04 + i * 0.05}s` }}
                onClick={followSegment}
              >
                <span className="dial-flyout__dot" />
                <span className="dial-flyout__txt">{label}</span>
                <ArrowUpRight size={15} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
