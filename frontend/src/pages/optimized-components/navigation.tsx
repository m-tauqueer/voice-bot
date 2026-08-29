import { useState } from "react";
import type { CSSProperties } from "react";
import { Button } from "../../components/ui/Button";
import { MemoryIcon } from "../../lib/memory-icons";

const TABS = [
  { id: "recall", label: "Recall", body: "Ask a question; the second brain answers from cited memories." },
  { id: "sources", label: "Sources", body: "Every connected feed, its sync status and item count." },
  { id: "graph", label: "Graph", body: "The semantic links discovered between your memories." },
];

export function Tabs() {
  const [active, setActive] = useState("recall");
  const index = TABS.findIndex((tab) => tab.id === active);

  return (
    <div className="oc-tabs">
      <div
        className="oc-tabs__list"
        role="tablist"
        style={{ ["--i" as string]: index, ["--n" as string]: TABS.length } as CSSProperties}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active === tab.id}
            className={"oc-tabs__tab" + (active === tab.id ? " is-active" : "")}
            onClick={() => setActive(tab.id)}
          >
            {tab.label}
          </button>
        ))}
        <span className="oc-tabs__ink" />
      </div>
      <div className="oc-tabs__panel">{TABS[index].body}</div>
    </div>
  );
}

const CRUMBS = ["Spaces", "Product", "Q3 launch"];

export function Breadcrumbs() {
  return (
    <nav className="oc-crumbs" aria-label="Breadcrumb">
      {CRUMBS.map((crumb, i) => (
        <span key={crumb} className="oc-crumbs__item">
          {i > 0 && <span className="oc-crumbs__sep"><MemoryIcon name="chevron-right" size={13} weight={2} /></span>}
          {i === CRUMBS.length - 1
            ? <span className="oc-crumbs__cur">{crumb}</span>
            : <a className="oc-crumbs__link">{crumb}</a>}
        </span>
      ))}
    </nav>
  );
}

const TOTAL_PAGES = 7;

export function Pagination() {
  const [page, setPage] = useState(3);

  return (
    <div className="oc-page">
      <button
        className="oc-page__nav"
        disabled={page === 1}
        onClick={() => setPage((current) => Math.max(1, current - 1))}
        aria-label="Previous"
      >
        <MemoryIcon name="chevron-right" size={15} weight={2} />
      </button>

      {Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1).map((n) => (
        <button key={n} className={"oc-page__n" + (n === page ? " is-on" : "")} onClick={() => setPage(n)}>{n}</button>
      ))}

      <button
        className="oc-page__nav oc-page__nav--next"
        disabled={page === TOTAL_PAGES}
        onClick={() => setPage((current) => Math.min(TOTAL_PAGES, current + 1))}
        aria-label="Next"
      >
        <MemoryIcon name="chevron-right" size={15} weight={2} />
      </button>
    </div>
  );
}

const STEPS = ["Connect a source", "Embed memories", "Build the graph", "Recall anything"];

export function Stepper() {
  const [current, setCurrent] = useState(2);

  return (
    <div>
      <div className="oc-steps">
        {STEPS.map((step, i) => {
          const state = i < current ? "done" : i === current ? "active" : "todo";
          return (
            <button key={step} className={`oc-step oc-step--${state}`} onClick={() => setCurrent(i)}>
              <span className="oc-step__dot">
                {i < current ? <MemoryIcon name="check" size={13} weight={2.6} /> : i + 1}
              </span>
              <span className="oc-step__lbl">{step}</span>
              {i < STEPS.length - 1 && <span className="oc-step__bar" />}
            </button>
          );
        })}
      </div>

      <div className="oc-steps__ctl">
        <Button variant="glass" size="sm" disabled={current === 0} onClick={() => setCurrent((i) => Math.max(0, i - 1))}>
          Back
        </Button>
        <Button
          variant="solid"
          size="sm"
          disabled={current === STEPS.length - 1}
          onClick={() => setCurrent((i) => Math.min(STEPS.length - 1, i + 1))}
        >
          Next step
        </Button>
      </div>
    </div>
  );
}

interface TreeNode {
  id: string;
  name: string;
  icon: string;
  children?: TreeNode[];
}

const TREE: TreeNode[] = [
  {
    id: "product", name: "Product", icon: "spaces", children: [
      {
        id: "roadmap", name: "Roadmap", icon: "folder", children: [
          { id: "q3", name: "Q3 launch plan", icon: "note" },
          { id: "q4", name: "Q4 themes", icon: "note" },
        ],
      },
      {
        id: "research", name: "Research", icon: "folder", children: [
          { id: "interviews", name: "User interviews", icon: "chat" },
        ],
      },
    ],
  },
  {
    id: "eng", name: "Engineering", icon: "spaces", children: [
      {
        id: "rfcs", name: "RFCs", icon: "folder", children: [
          { id: "oauth", name: "OAuth redesign", icon: "document" },
        ],
      },
    ],
  },
];

const TREE_INDENT = 18;

function TreeRow({ node, depth, expanded, onToggle }: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
}) {
  const hasChildren = !!node.children?.length;
  const isOpen = expanded.has(node.id);

  return (
    <>
      <button
        className="oc-tree__row"
        style={{ paddingLeft: 8 + depth * TREE_INDENT }}
        onClick={() => hasChildren && onToggle(node.id)}
      >
        <span className={"oc-tree__chev" + (hasChildren ? "" : " is-hidden") + (isOpen ? " is-open" : "")}>
          <MemoryIcon name="chevron-right" size={13} weight={2} />
        </span>
        <span className="oc-tree__ic"><MemoryIcon name={node.icon} size={15} weight={1.7} /></span>
        <span className="oc-tree__nm">{node.name}</span>
      </button>

      {hasChildren && isOpen && node.children!.map((child) => (
        <TreeRow key={child.id} node={child} depth={depth + 1} expanded={expanded} onToggle={onToggle} />
      ))}
    </>
  );
}

export function Tree() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["product", "roadmap"]));

  const toggle = (id: string) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  return (
    <div className="oc-tree">
      {TREE.map((node) => <TreeRow key={node.id} node={node} depth={0} expanded={expanded} onToggle={toggle} />)}
    </div>
  );
}
