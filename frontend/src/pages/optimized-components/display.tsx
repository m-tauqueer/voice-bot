import { useEffect, useRef, useState } from "react";
import { IconButton } from "../../components/ui/Button";
import { DotMeter } from "../../components/ui/Meter";
import { ArrowUpRight, ChevronDown, Search } from "../../components/icons";
import { MemoryIcon } from "../../lib/memory-icons";
import { Kbd } from "./layout";

const MEMORY_ROWS = [
  { title: "Q3 launch plan", icon: "note", src: "Notion", recalls: 38, lit: 5, links: 12, when: "2d ago" },
  { title: "OAuth refresh bug", icon: "document", src: "Linear", recalls: 21, lit: 4, links: 7, when: "5h ago" },
  { title: "Pricing v3 thoughts", icon: "note", src: "Obsidian", recalls: 14, lit: 3, links: 5, when: "1d ago" },
  { title: "Onboarding flow audit", icon: "chat", src: "Slack", recalls: 9, lit: 2, links: 3, when: "6h ago" },
];

export function MemoryTable() {
  return (
    <div className="oc-table">
      <div className="oc-table__head">
        <span className="oc-table__h">Memory</span>
        <span className="oc-table__h">Source</span>
        <span className="oc-table__h">Recalls <ChevronDown size={12} /></span>
        <span className="oc-table__h">Links</span>
        <span className="oc-table__h">Last touched</span>
      </div>

      {MEMORY_ROWS.map((row) => (
        <div className="oc-table__row" key={row.title}>
          <span className="oc-table__mem">
            <span className="oc-table__glyph"><MemoryIcon name={row.icon} size={16} weight={1.7} /></span>
            <span className="oc-table__title">{row.title}</span>
          </span>
          <span className="oc-table__src">{row.src}</span>
          <span className="oc-table__num" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            {row.recalls}<DotMeter value={row.lit} />
          </span>
          <span className="oc-table__num">{row.links}</span>
          <span className="oc-table__when">{row.when}</span>
          <span className="oc-table__acts">
            <IconButton size={28} aria-label="Open"><ArrowUpRight size={14} /></IconButton>
            <IconButton size={28} aria-label="More"><MemoryIcon name="more" size={15} weight={2} /></IconButton>
          </span>
        </div>
      ))}
    </div>
  );
}

const COMMAND_GROUPS: { eyebrow: string; rows: { icon: string; label: string; kbd?: string }[] }[] = [
  {
    eyebrow: "Recent",
    rows: [
      { icon: "ai-spark", label: "Recall: “Q3 launch plan”" },
      { icon: "document", label: "Open: “OAuth refresh bug”" },
    ],
  },
  {
    eyebrow: "Actions",
    rows: [
      { icon: "link", label: "Link to current note", kbd: "⌘L" },
      { icon: "ai-spark", label: "Summarize this source" },
      { icon: "upload", label: "Ingest a file or URL", kbd: "⌘I" },
    ],
  },
  {
    eyebrow: "Memories",
    rows: [
      { icon: "note", label: "Note · “Pricing v3 thoughts”" },
      { icon: "chat", label: "Conversation · Slack #launch" },
    ],
  },
];

const COMMAND_COUNT = COMMAND_GROUPS.reduce((total, group) => total + group.rows.length, 0);

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setActive(0);
    inputRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => (i + 1) % COMMAND_COUNT);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => (i - 1 + COMMAND_COUNT) % COMMAND_COUNT);
      } else if (e.key === "Enter" || e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  let flatIndex = -1;

  return (
    <div className={"oc-cmdk" + (open ? " is-open" : "")} onClick={onClose} aria-hidden={!open}>
      <div
        className="oc-cmdk__panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <div className="oc-cmdk__search">
          <Search size={18} />
          <input ref={inputRef} className="oc-cmdk__input" placeholder="Ask your memory anything…" />
          <Kbd>esc</Kbd>
        </div>

        <div className="oc-cmdk__body">
          {COMMAND_GROUPS.map((group) => (
            <div key={group.eyebrow}>
              <div className="oc-cmdk__eyebrow">{group.eyebrow}</div>
              {group.rows.map((row) => {
                flatIndex += 1;
                const index = flatIndex;
                return (
                  <div
                    key={row.label}
                    className={"oc-cmdk__row" + (index === active ? " is-active" : "")}
                    onMouseEnter={() => setActive(index)}
                    onClick={onClose}
                  >
                    <span className="oc-cmdk__ic"><MemoryIcon name={row.icon} size={16} weight={1.7} /></span>
                    <span className="oc-cmdk__label">{row.label}</span>
                    {row.kbd ? <Kbd>{row.kbd}</Kbd> : <ArrowUpRight size={13} />}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="oc-cmdk__foot">
          <span><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
          <span><Kbd>↵</Kbd> open</span>
          <span><Kbd>esc</Kbd> close</span>
        </div>
      </div>
    </div>
  );
}

const CODE_SAMPLE = `import { MemoryIcon } from "@/lib/memory-icons";

export function Node() {
  return (
    <MemoryIcon name="logo-mark" size={24} weight={1.75} />
  );
}`;

const COPIED_RESET_MS = 1400;

export function CodeBlock() {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    if (navigator.clipboard) navigator.clipboard.writeText(CODE_SAMPLE).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), COPIED_RESET_MS);
  };

  return (
    <div className="oc-code">
      <div className="oc-code__bar">
        <span className="oc-code__dots"><i /><i /><i /></span>
        <span className="oc-code__file">Node.tsx</span>
        <button className="oc-code__copy" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
      </div>
      <pre className="oc-code__pre"><code>{CODE_SAMPLE}</code></pre>
    </div>
  );
}
