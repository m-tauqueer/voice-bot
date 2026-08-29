import { IconButton } from "../../components/ui/Button";
import { DotMeter } from "../../components/ui/Meter";
import { AvatarStack } from "../../components/Avatar";
import { av } from "../../components/ScheduleBar";
import { useCornerNotch } from "../../components/useCornerNotch";
import { ArrowUpRight, Bell, Plus, Search } from "../../components/icons";
import { MemoryIcon } from "../../lib/memory-icons";

const SINGLE_NOTCH = [{ cxR: 33, cy: 27, r: 21 }];
const DOUBLE_NOTCH = [{ cxR: 33, cy: 27, r: 21 }, { cxR: 79, cy: 27, r: 19 }];
const NOTCH_SWEEP = { sweep: 30 };

interface MemoryCardData {
  glyph: string;
  source: string;
  title: string;
  excerpt: string;
  tags: string[];
  recalls: number;
  double: boolean;
}

export const MEMORY_CARDS: MemoryCardData[] = [
  {
    glyph: "document", source: "PDF · Drive", title: "Series-B data-room notes",
    excerpt: "Key terms, the cap-table math and the three diligence questions still open before close.",
    tags: ["finance", "diligence"], recalls: 5, double: false,
  },
  {
    glyph: "chat", source: "Conversation · Slack", title: "Launch retro — what slipped",
    excerpt: "Threaded recap of #launch: the rollout gate, the rollback, and who owns each follow-up.",
    tags: ["launch", "retro"], recalls: 4, double: true,
  },
  {
    glyph: "note", source: "Note · Obsidian", title: "OAuth refresh-token flow",
    excerpt: "How the silent refresh works, where it breaks on Safari, and the fix we shipped Tuesday.",
    tags: ["auth", "fix"], recalls: 3, double: false,
  },
];

export function MemoryCard({ memory }: { memory: MemoryCardData }) {
  const ref = useCornerNotch(memory.double ? DOUBLE_NOTCH : SINGLE_NOTCH, NOTCH_SWEEP);

  return (
    <article className="lead-wrap">
      <div className="lead" ref={ref}>
        <div className="oc-mem__top" style={{ paddingRight: memory.double ? 100 : 52 }}>
          <span className="oc-mem__glyph"><MemoryIcon name={memory.glyph} size={20} weight={1.7} /></span>
          <div style={{ minWidth: 0 }}>
            <div className="oc-mem__src">{memory.source}</div>
            <div className="oc-mem__kind">Memory</div>
          </div>
        </div>

        <div className="oc-mem__title">{memory.title}</div>
        <p className="oc-mem__excerpt">{memory.excerpt}</p>

        <div className="oc-mem__foot">
          <div className="oc-mem__tags">
            {memory.tags.map((tag) => <span key={tag} className="tagchip">{tag}</span>)}
          </div>
          <DotMeter value={memory.recalls} />
        </div>
      </div>

      {memory.double && <button className="float float--bell" aria-label="reminder"><Bell size={15} /><span className="ping" /></button>}
      <button className="float float--arrow" aria-label="open"><ArrowUpRight size={16} /></button>
    </article>
  );
}

function PanelHead({ icon, title, sub, trailing }: {
  icon: string;
  title: string;
  sub: string;
  trailing: React.ReactNode;
}) {
  return (
    <div className="oc-recall__head">
      <span className="oc-recall__badge"><MemoryIcon name={icon} size={16} weight={1.9} /></span>
      <div className="oc-recall__htext">
        <div className="oc-recall__title">{title}</div>
        <div className="oc-recall__sub">{sub}</div>
      </div>
      {trailing}
    </div>
  );
}

function CitationRow({ title, source, icon, recalls }: {
  title: string;
  source: string;
  icon: string;
  recalls: number;
}) {
  return (
    <div className="oc-recall__cite">
      <span className="oc-recall__cg"><MemoryIcon name={icon} size={15} weight={1.7} /></span>
      <div className="oc-recall__ct">
        <div className="oc-recall__cn">{title}</div>
        <div className="oc-recall__cs">{source}</div>
      </div>
      <DotMeter value={recalls} />
    </div>
  );
}

const RECALL_CITATIONS = [
  { title: "Series-B data-room notes", source: "PDF · Drive · 2d", icon: "document", recalls: 5 },
  { title: "Term sheet — final draft", source: "Note · Obsidian · 5h", icon: "note", recalls: 4 },
  { title: "Legal sync recap", source: "Conversation · Slack", icon: "chat", recalls: 3 },
];

export function RecallPanel() {
  return (
    <aside className="callpanel oc-recall">
      <PanelHead
        icon="ai-spark"
        title="Recall"
        sub="ask your second brain"
        trailing={<IconButton size={30} aria-label="Expand"><ArrowUpRight size={15} /></IconButton>}
      />

      <div className="oc-recall__q"><Search size={15} /><span>When does the Series-B close?</span></div>

      <div className="ui-card ui-card--glass oc-recall__ans">
        <p>The round closes <b>Friday, June 13</b> — pending the two open diligence items in the data room. The <mark>cap-table math</mark> is already final.</p>
        <div className="oc-recall__chips">
          <span className="tagchip">3 sources</span>
          <span className="tagchip">98% confidence</span>
        </div>
      </div>

      <div className="oc-recall__cites">
        <div className="oc-recall__clbl">Cited memories</div>
        {RECALL_CITATIONS.map((citation) => <CitationRow key={citation.title} {...citation} />)}
      </div>
    </aside>
  );
}

const CAPTURE_SOURCES = [
  { icon: "note", label: "Notion" },
  { icon: "chat", label: "Slack" },
  { icon: "globe", label: "Web" },
  { icon: "folder", label: "Drive" },
];

export function CapturePanel() {
  return (
    <aside className="callpanel oc-recall">
      <PanelHead
        icon="upload"
        title="Capture"
        sub="add to your memory"
        trailing={<IconButton size={30} aria-label="New"><Plus size={15} /></IconButton>}
      />

      <div className="oc-drop">
        <MemoryIcon name="upload" size={22} weight={1.6} />
        <div className="oc-drop__t">Drop a file, paste a URL or note</div>
        <div className="oc-drop__s">PDF · MD · web · audio</div>
      </div>

      <div className="oc-recall__clbl">Quick connect</div>
      <div className="oc-chiprow">
        {CAPTURE_SOURCES.map((source) => (
          <button key={source.label} className="oc-srcchip">
            <MemoryIcon name={source.icon} size={14} weight={1.7} />{source.label}
          </button>
        ))}
      </div>
    </aside>
  );
}

const DIGEST_STATS = [
  { icon: "upload", label: "Ingested", value: "312 items" },
  { icon: "link", label: "Linked", value: "48 edges" },
  { icon: "ai-spark", label: "Reinforced", value: "19 memories" },
];

const DIGEST_HIGHLIGHTS = [
  { title: "Q3 launch plan updated", source: "Notion · 2h", icon: "note", recalls: 4 },
  { title: "New OAuth thread linked", source: "Slack · 4h", icon: "chat", recalls: 3 },
];

export function DigestPanel() {
  return (
    <aside className="callpanel oc-recall">
      <PanelHead
        icon="trend"
        title="Today's digest"
        sub="7 Jun · what changed"
        trailing={<IconButton size={30} aria-label="Open"><ArrowUpRight size={15} /></IconButton>}
      />

      <div className="oc-stats">
        {DIGEST_STATS.map((stat) => (
          <div className="oc-stat" key={stat.label}>
            <span className="oc-stat__ic"><MemoryIcon name={stat.icon} size={15} weight={1.7} /></span>
            <span className="oc-stat__l">{stat.label}</span>
            <span className="oc-stat__v">{stat.value}</span>
          </div>
        ))}
      </div>

      <div className="oc-recall__clbl">Highlights</div>
      {DIGEST_HIGHLIGHTS.map((highlight) => <CitationRow key={highlight.title} {...highlight} />)}
    </aside>
  );
}

const SPACE_MEMORIES = [
  { title: "Pricing v3 thoughts", source: "Note · 1d", icon: "note", recalls: 3 },
  { title: "Onboarding flow audit", source: "Slack · 6h", icon: "chat", recalls: 2 },
  { title: "API redesign RFC", source: "PDF · 2d", icon: "document", recalls: 4 },
];

const SPACE_MEMBERS = [{ name: "C", src: av(3) }, { name: "D", src: av(4) }, { name: "E", src: av(6) }];

export function SpacePanel() {
  return (
    <aside className="callpanel oc-recall">
      <PanelHead
        icon="spaces"
        title="Product"
        sub="Space · 1,204 memories"
        trailing={
          <span style={{ marginLeft: "auto" }}>
            <AvatarStack people={SPACE_MEMBERS} size={24} />
          </span>
        }
      />

      <div className="oc-chiprow">
        {["roadmap", "specs", "research"].map((tag) => <span key={tag} className="tagchip">{tag}</span>)}
      </div>

      <div className="oc-recall__clbl">Recent in this space</div>
      {SPACE_MEMORIES.map((memory) => <CitationRow key={memory.title} {...memory} />)}
    </aside>
  );
}
