import { useLayoutEffect, useRef, useState } from "react";
import { navigate } from "../../lib/router";
import { ROUTES } from "../../lib/routes";
import { MemoryIcon } from "../../lib/memory-icons";
import { Menu } from "../../components/icons";

export type NavId = "dashboard" | "chat" | "workspaces" | "users" | "connectors" | "logs";

interface NavItem {
  id: NavId;
  label: string;
  icon: string;
  to?: string;
}

const NAV: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard", to: ROUTES.dashboard },
  { id: "chat", label: "Chat", icon: "chat" },
  { id: "workspaces", label: "Workspaces", icon: "spaces" },
  { id: "users", label: "Manage Users", icon: "users" },
  { id: "connectors", label: "Connectors", icon: "connector" },
  { id: "logs", label: "Logs", icon: "history" },
];

const PREFERRED_ABOVE_NOTCH = 3;

const PANEL_RADIUS = 26;
const DIAL_RADIUS = 28;
const DIAL_GAP = 8;
const SCOOP_RADIUS = DIAL_RADIUS + DIAL_GAP;
const SCOOP_HALF_ANGLE = (58 * Math.PI) / 180;
const FILLET_RUN = 16;
const FILLET_HANDLE = SCOOP_RADIUS * 0.42;

function notchBand(height: number) {
  const reach = SCOOP_RADIUS * Math.sin(SCOOP_HALF_ANGLE) + FILLET_RUN;
  const centreY = height / 2;
  return { top: centreY - reach, bottom: centreY + reach };
}

function sidebarSilhouette(width: number, height: number) {
  const round = (v: number) => v.toFixed(1);
  const centreY = height / 2;

  const cos = Math.cos(SCOOP_HALF_ANGLE);
  const sin = Math.sin(SCOOP_HALF_ANGLE);
  const scoopX = width - SCOOP_RADIUS * cos;
  const scoopTopY = centreY - SCOOP_RADIUS * sin;
  const scoopBottomY = centreY + SCOOP_RADIUS * sin;
  const { top: filletTopY, bottom: filletBottomY } = notchBand(height);

  return [
    `M ${PANEL_RADIUS} 0`,
    `L ${width - PANEL_RADIUS} 0`,
    `A ${PANEL_RADIUS} ${PANEL_RADIUS} 0 0 1 ${width} ${PANEL_RADIUS}`,
    `L ${width} ${round(filletTopY)}`,
    `C ${width} ${round(filletTopY + FILLET_RUN * 0.6)} ${round(scoopX + sin * FILLET_HANDLE)} ${round(scoopTopY - cos * FILLET_HANDLE)} ${round(scoopX)} ${round(scoopTopY)}`,
    `A ${SCOOP_RADIUS} ${SCOOP_RADIUS} 0 0 0 ${round(scoopX)} ${round(scoopBottomY)}`,
    `C ${round(scoopX + sin * FILLET_HANDLE)} ${round(scoopBottomY + cos * FILLET_HANDLE)} ${width} ${round(filletBottomY - FILLET_RUN * 0.6)} ${width} ${round(filletBottomY)}`,
    `L ${width} ${height - PANEL_RADIUS}`,
    `A ${PANEL_RADIUS} ${PANEL_RADIUS} 0 0 1 ${width - PANEL_RADIUS} ${height}`,
    `L ${PANEL_RADIUS} ${height}`,
    `A ${PANEL_RADIUS} ${PANEL_RADIUS} 0 0 1 0 ${height - PANEL_RADIUS}`,
    `L 0 ${PANEL_RADIUS}`,
    `A ${PANEL_RADIUS} ${PANEL_RADIUS} 0 0 1 ${PANEL_RADIUS} 0`,
    `Z`,
  ].join(" ");
}

function itemsThatFit(nav: HTMLElement, headroom: number) {
  const item = nav.querySelector<HTMLElement>(".mc-nav__item");
  if (!item || !item.parentElement) return PREFERRED_ABOVE_NOTCH;

  const gap = parseFloat(getComputedStyle(item.parentElement).rowGap) || 0;
  const pitch = item.offsetHeight + gap;
  if (pitch <= 0) return PREFERRED_ABOVE_NOTCH;

  return Math.max(0, Math.floor((headroom + gap) / pitch));
}

function useSidebarSilhouette() {
  const ref = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const [shape, setShape] = useState({
    clip: "",
    width: 0,
    height: 0,
    headroom: 0,
    notch: 0,
    aboveCount: PREFERRED_ABOVE_NOTCH,
  });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const width = el.offsetWidth;
      const height = el.offsetHeight;
      if (!width || !height) return;

      const nav = navRef.current;
      const band = notchBand(height);
      const navTop = nav ? nav.getBoundingClientRect().top - el.getBoundingClientRect().top : 0;
      const headroom = Math.max(0, band.top - navTop);

      setShape({
        clip: sidebarSilhouette(width, height),
        width,
        height,
        headroom,
        notch: band.bottom - band.top,
        aboveCount: nav
          ? Math.min(PREFERRED_ABOVE_NOTCH, itemsThatFit(nav, headroom))
          : PREFERRED_ABOVE_NOTCH,
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, navRef, ...shape };
}

function NavButton({ item, isActive }: { item: NavItem; isActive: boolean }) {
  return (
    <button
      className={"mc-nav__item" + (isActive ? " is-active" : "")}
      onClick={item.to ? () => navigate(item.to!) : undefined}
      aria-disabled={item.to ? undefined : true}
      title={item.label}
      aria-current={isActive ? "page" : undefined}
    >
      <span className="mc-nav__ic"><MemoryIcon name={item.icon} size={19} weight={1.7} /></span>
      <span className="mc-nav__label">{item.label}</span>
    </button>
  );
}

export function Sidebar({ active, onToggle, onOpenDial }: {
  active: NavId;
  collapsed: boolean;
  onToggle: () => void;
  onOpenDial: () => void;
}) {
  const silhouette = useSidebarSilhouette();

  return (
    <div className="mc-sidebar-slot">
      <aside
        ref={silhouette.ref}
        className="mc-sidebar"
        style={{ clipPath: silhouette.clip ? `path('${silhouette.clip}')` : undefined }}
      >
        <div className="mc-sidebar__head">
          <button className="mc-brand" onClick={() => navigate(ROUTES.components)} aria-label="Metacognition home">
            <span className="mc-brand__mark"><img src="/Logo-white.svg" alt="" width={20} height={20} /></span>
            <span className="mc-brand__word">Metacognition</span>
          </button>
          <button className="mc-menu" aria-label="Toggle menu" onClick={onToggle}>
            <Menu size={18} />
          </button>
        </div>

        <nav className="mc-nav" ref={silhouette.navRef} aria-label="Primary">
          <div className="mc-nav__group" style={{ minHeight: silhouette.headroom }}>
            {NAV.slice(0, silhouette.aboveCount).map((item) => (
              <NavButton key={item.id} item={item} isActive={active === item.id} />
            ))}
          </div>

          <div className="mc-nav__notch" style={{ height: silhouette.notch }} aria-hidden />

          <div className="mc-nav__group mc-nav__group--tail">
            {NAV.slice(silhouette.aboveCount).map((item) => (
              <NavButton key={item.id} item={item} isActive={active === item.id} />
            ))}
          </div>
        </nav>
      </aside>

      {silhouette.clip && (
        <svg
          className="mc-sidebar__seam"
          width={silhouette.width}
          height={silhouette.height}
          viewBox={`0 0 ${silhouette.width} ${silhouette.height}`}
          preserveAspectRatio="none"
          fill="none"
          aria-hidden
        >
          <path d={silhouette.clip} stroke="var(--rule-strong)" strokeWidth={1} />
        </svg>
      )}

      <button className="mc-dial" aria-label="Open quick dial" onClick={onOpenDial}>
        <span className="mc-dial__ring" />
        <span className="mc-dial__ico"><img src="/Logo-white.svg" alt="" width={22} height={22} /></span>
      </button>
    </div>
  );
}
