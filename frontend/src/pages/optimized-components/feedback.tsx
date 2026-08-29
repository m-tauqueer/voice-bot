import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ChevronDown, Close, Plus } from "../../components/icons";
import { MemoryIcon } from "../../lib/memory-icons";

type AlertTone = "info" | "success" | "warn" | "error";

export const ALERTS: { tone: AlertTone; icon: string; title: string; desc: string }[] = [
  { tone: "info", icon: "info", title: "Indexing in background", desc: "New memories appear in recall as they finish embedding." },
  { tone: "success", icon: "check", title: "Workspace connected", desc: "Notion synced — 1,204 items are now searchable." },
  { tone: "warn", icon: "bell", title: "A source is stale", desc: "Google Drive hasn’t synced in 6 days. Re-authenticate to resume." },
  { tone: "error", icon: "info", title: "Ingest failed", desc: "Web Clipper lost its connection. Reconnect to continue capturing." },
];

export function Alert({ tone, icon, title, desc }: { tone: AlertTone; icon: string; title: string; desc: string }) {
  return (
    <div className={`oc-alert oc-alert--${tone}`}>
      <span className="oc-alert__ic"><MemoryIcon name={icon} size={16} weight={1.9} /></span>
      <div className="oc-alert__body">
        <div className="oc-alert__title">{title}</div>
        <div className="oc-alert__desc">{desc}</div>
      </div>
      <button className="oc-alert__x" aria-label="Dismiss"><Close size={13} /></button>
    </div>
  );
}

type ToastType = "info" | "busy" | "error";

interface Toast {
  id: number;
  type: ToastType;
  title: string;
  sub: string;
  action?: string;
}

const TOAST_SEED: Toast[] = [
  { id: 1, type: "info", title: "Notion synced", sub: "1,204 items indexed" },
  { id: 2, type: "busy", title: "Memory linked", sub: "“OAuth” ↔ “Auth service”", action: "View" },
  { id: 3, type: "error", title: "Ingest failed", sub: "Web Clipper · check connection", action: "Reconnect" },
];

const TOAST_SAMPLES: Omit<Toast, "id">[] = [
  { type: "info", title: "Drive synced", sub: "18 new PDFs embedded" },
  { type: "busy", title: "Re-indexing", sub: "rebuilding the knowledge graph" },
  { type: "info", title: "Memory reinforced", sub: "“pricing-v3” retrieved again" },
  { type: "error", title: "Sync stalled", sub: "Slack · token expired", action: "Reconnect" },
];

const TOAST_TINT: Record<ToastType, string> = {
  error: "var(--color-error)",
  busy: "var(--accent)",
  info: "rgba(255,255,255,.6)",
};

const TOAST_ICON: Record<ToastType, string> = {
  error: "info",
  busy: "link",
  info: "check",
};

const AUTO_DISMISS_MS = 5000;
const FIRST_EMITTED_ID = 100;

function ToastItem({ toast, onClose, auto = false }: {
  toast: Toast;
  onClose: (id: number) => void;
  auto?: boolean;
}) {
  useEffect(() => {
    if (!auto) return;
    const timer = window.setTimeout(() => onClose(toast.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [auto, toast.id, onClose]);

  const tint = TOAST_TINT[toast.type];

  return (
    <Card variant="glass" className="oc-toast">
      <span className="oc-toast__bar" style={{ background: tint }} />
      <span
        className="oc-toast__ic"
        style={{ background: `color-mix(in srgb, ${tint} 22%, transparent)`, color: tint }}
      >
        <MemoryIcon name={TOAST_ICON[toast.type]} size={16} weight={1.9} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="oc-toast__title">{toast.title}</div>
        <div className="oc-toast__sub">{toast.sub}</div>
      </div>
      {toast.action && <button className="oc-toast__act">{toast.action}</button>}
      <button
        className="ibtn oc-toast__x"
        style={{ width: 26, height: 26 }}
        aria-label="Dismiss"
        onClick={() => onClose(toast.id)}
      >
        <Close size={13} />
      </button>
      {auto && <span className="oc-toast__prog" />}
    </Card>
  );
}

export function ActivityToast() {
  const [toasts, setToasts] = useState<Toast[]>(TOAST_SEED);
  const nextId = useRef(FIRST_EMITTED_ID);

  const remove = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const emit = () => {
    const id = nextId.current++;
    const sample = TOAST_SAMPLES[id % TOAST_SAMPLES.length];
    setToasts((current) => [...current, { ...sample, id }]);
  };

  return (
    <div>
      <Button variant="glass" icon={<Plus size={15} />} onClick={emit}>Emit an event</Button>
      <div className="oc-toaststack">
        {toasts.length === 0 && <span className="oc-empty-note">no events — emit one ↑</span>}
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={remove} auto={toast.id >= FIRST_EMITTED_ID} />
        ))}
      </div>
    </div>
  );
}

export function Tip({ label, children }: { label: string; children: ReactNode }) {
  return <span className="oc-tip" tabIndex={0}>{children}<span className="oc-tip__pop">{label}</span></span>;
}

const FILTER_OPTIONS = ["Hot this week", "Recently added", "Most linked", "Needs review"];

export function Popover() {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState(FILTER_OPTIONS[0]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onMouseDown);
    return () => window.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  return (
    <div className="oc-pop" ref={ref}>
      <Button
        variant="glass"
        icon={<MemoryIcon name="filter" size={15} weight={1.8} />}
        iconRight={<ChevronDown size={13} />}
        onClick={() => setOpen((value) => !value)}
      >
        {picked}
      </Button>

      {open && (
        <div className="oc-pop__panel" role="menu">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option}
              role="menuitemradio"
              aria-checked={option === picked}
              className={"oc-pop__opt" + (option === picked ? " is-on" : "")}
              onClick={() => { setPicked(option); setOpen(false); }}
            >
              {option}{option === picked && <MemoryIcon name="check" size={14} weight={2.4} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const FAQ = [
  { q: "How are memories embedded?", a: "Each capture is chunked and embedded into a vector index; the original is kept for citation." },
  { q: "What stays private?", a: "Sources you mark private never leave your workspace and are excluded from shared spaces." },
  { q: "How does recall rank results?", a: "By semantic similarity, recency and how often a memory has been reinforced." },
];

export function Accordion() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="oc-acc">
      {FAQ.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q} className={"oc-acc__item" + (isOpen ? " is-open" : "")}>
            <button className="oc-acc__head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : i)}>
              <span>{item.q}</span>
              <span className="oc-acc__chev"><ChevronDown size={16} /></span>
            </button>
            <div className="oc-acc__body"><div className="oc-acc__inner">{item.a}</div></div>
          </div>
        );
      })}
    </div>
  );
}

export function EmptyState() {
  return (
    <div className="oc-empty">
      <span className="oc-empty__ic"><MemoryIcon name="search" size={26} weight={1.6} /></span>
      <div className="oc-empty__t">No memories match “orbital”</div>
      <p className="oc-empty__d">Try a broader query, or capture something new to remember.</p>
      <Button variant="solid" icon={<Plus size={15} />}>Capture a memory</Button>
    </div>
  );
}

export function MemorySkeletons() {
  return (
    <div className="oc-grid oc-grid--3">
      <Card variant="glass">
        <div className="oc-skel oc-skel--line" style={{ width: "42%" }} />
        <div className="oc-skel oc-skel--line" style={{ width: "66%", height: 24, marginTop: 12 }} />
        <div className="oc-skel oc-skel--tile" style={{ marginTop: 14 }} />
      </Card>

      <Card variant="glass">
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginTop: i ? 16 : 0 }}>
            <div className="oc-skel oc-skel--circle" style={{ width: 34, height: 34 }} />
            <div style={{ flex: 1 }}>
              <div className="oc-skel oc-skel--line" style={{ width: "55%" }} />
              <div className="oc-skel oc-skel--line" style={{ width: "80%", marginTop: 8 }} />
            </div>
          </div>
        ))}
      </Card>

      <Card variant="glass" style={{ display: "grid", placeItems: "center" }}>
        <div className="oc-skel oc-skel--circle" style={{ width: 96, height: 96 }} />
      </Card>
    </div>
  );
}
