import { useEffect, useState } from "react";

import { navigate } from "../../lib/router";
import { ROUTES } from "../../lib/routes";
import { Badge } from "../../components/ui/Badge";
import { Button, IconButton } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Chip } from "../../components/ui/Chip";
import { ClipButton } from "../../components/ui/ClipButton";
import { Input, Textarea } from "../../components/ui/Input";
import { BarMeter, DotMeter } from "../../components/ui/Meter";
import { Segmented } from "../../components/ui/Segmented";
import { Switch } from "../../components/ui/Switch";

import { Avatar, AvatarStack } from "../../components/Avatar";
import { RadialMenu } from "../../components/RadialMenu";
import { ScheduleBar, av } from "../../components/ScheduleBar";
import { WorkspaceHeader } from "../../components/WorkspaceHeader";
import { ActivityCalendar, LegendScale, MemoryComposition, NodeRing, RecallHeatmap } from "../../components/viz";
import { ArrowUpRight, Bell, Flame, Grid, Menu, Plus, Search } from "../../components/icons";
import { memoryIconSvg } from "../../lib/memory-icons";

import { Demo, Kbd, Sec } from "./layout";
import { SECTION_GROUPS, SECTION_IDS } from "./sections";
import { useScrollSpy } from "./useScrollSpy";
import {
  BRAND_SWATCHES, INK_SWATCHES, IconExplorer, PRODUCT_ICONS, SURFACE_SWATCHES,
  Swatch, TYPE_SPECIMENS, TypeRow,
} from "./foundations";
import { COMPOSITION, MemoryTimeline, SourceGraph, SourceHealthRows, VitalsGrid } from "./dataviz";
import { OcCheckbox, OcRadioGroup, OcSlider, TagInput } from "./controls";
import { Breadcrumbs, Pagination, Stepper, Tabs, Tree } from "./navigation";
import { ALERTS, Accordion, ActivityToast, Alert, EmptyState, MemorySkeletons, Popover, Tip } from "./feedback";
import { CodeBlock, CommandPalette, MemoryTable } from "./display";
import { CapturePanel, DigestPanel, MEMORY_CARDS, MemoryCard, RecallPanel, SpacePanel } from "./surfaces";

const GOOGLE_FONTS_ID = "oc-google-fonts";
const GOOGLE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700&family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap";

const COPY_TOAST_MS = 1600;

function useGalleryFonts() {
  useEffect(() => {
    if (document.getElementById(GOOGLE_FONTS_ID)) return;
    const link = document.createElement("link");
    link.id = GOOGLE_FONTS_ID;
    link.rel = "stylesheet";
    link.href = GOOGLE_FONTS_HREF;
    document.head.appendChild(link);
  }, []);
}

function useCommandPaletteShortcut(setOpen: (update: (open: boolean) => boolean) => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);
}

const FONT_MODES = [
  { value: "modern", label: "Bricolage · Hanken" },
  { value: "geist", label: "Geist" },
  { value: "brand", label: "Brand faces" },
] as const;

type FontMode = (typeof FONT_MODES)[number]["value"];

const FONT_MODE_CLASS: Record<FontMode, string> = {
  modern: " font-modern",
  geist: " font-geist",
  brand: "",
};

const scrollToSection = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
};

export function OptimizedComponentsPage() {
  const [fontMode, setFontMode] = useState<FontMode>("brand");
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [dialOpen, setDialOpen] = useState(false);

  const [pushOn, setPushOn] = useState(true);
  const [betaOn, setBetaOn] = useState(false);
  const [tab, setTab] = useState<"overview" | "specs" | "usage">("overview");
  const [tags, setTags] = useState(["Notion", "Slack", "Web"]);
  const [checks, setChecks] = useState<Set<string>>(new Set(["docs", "convos"]));
  const [radio, setRadio] = useState("semantic");

  const [iconQuery, setIconQuery] = useState("");
  const [iconSize, setIconSize] = useState("30");
  const [iconWeight, setIconWeight] = useState("1.75");
  const [iconColour, setIconColour] = useState("var(--text-hi)");
  const [copied, setCopied] = useState<string | null>(null);

  const active = useScrollSpy(SECTION_IDS);

  useGalleryFonts();
  useCommandPaletteShortcut(setCmdkOpen);

  const copyIcon = (name: string) => {
    const svg = memoryIconSvg(name, parseFloat(iconWeight));
    if (navigator.clipboard) navigator.clipboard.writeText(svg).catch(() => {});
    setCopied(name);
    window.setTimeout(() => setCopied((current) => (current === name ? null : current)), COPY_TOAST_MS);
  };

  const toggleCheck = (key: string) => setChecks((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });

  return (
    <div className={"oc" + FONT_MODE_CLASS[fontMode]}>
      <div className="oc__topbar">
        <div className="oc__brand">
          <span className="oc__brand-mark"><img src="/Logo-white.svg" alt="Logo" width={20} height={20} /></span>
          Metacognition
        </div>
        <div className="oc__navlinks">
          <button className="oc__navlink" onClick={() => navigate(ROUTES.dashboard)}>Dashboard<ArrowUpRight size={14} /></button>
          <button className="oc__navlink" onClick={() => setCmdkOpen(true)}><Search size={14} />Search<Kbd>⌘K</Kbd></button>
        </div>
      </div>

      <header className="oc__hero">
        <div className="oc__eyebrow">Optimized · Component Library</div>
        <h1 className="oc__title">Every component, <em>aligned.</em></h1>
        <p className="oc__sub">
          A rebuilt, scalability-first edition of the memory-product design system — one section
          registry drives a sticky table of contents and scroll-spy, every visual is a
          dependency-free SVG, and the 67-icon set lives in a single shared module.
        </p>
        <div className="oc__controls">
          <span className="oc__ctrl-label">Typeface</span>
          <Segmented value={fontMode} onChange={setFontMode} options={FONT_MODES as unknown as { value: FontMode; label: string }[]} />
          <span className="oc__ctrl-hint">live-swaps the whole page</span>
        </div>
        <div className="oc__meta">
          <span><b>67</b> memory icons</span>
          <span><b>{SECTION_IDS.length}</b> sections</span>
          <span><b>15</b> new components</span>
          <span><b>3</b> typefaces</span>
          <span>press <b>⌘K</b> anywhere</span>
        </div>
      </header>

      <div className="oc__shell">
        <nav className="oc__toc" aria-label="Component index">
          {SECTION_GROUPS.map((group) => (
            <div className="oc__toc-group" key={group.group}>
              <div className="oc__toc-glabel">{group.group}</div>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  className={"oc__toc-link" + (active === item.id ? " is-active" : "")}
                  onClick={() => scrollToSection(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <main className="oc__main">
          <Sec id="colour" eyebrow="Foundations" title="Colour" desc="Neutrals come from a white-alpha ladder, not grey hexes. Orange is the only accent — a scalpel — and the lone ember surface is grain-textured.">
            <div className="oc-sec__desc" style={{ marginBottom: 12 }}>Brand &amp; semantic</div>
            <div className="oc-grid oc-grid--auto">{BRAND_SWATCHES.map((c) => <Swatch key={c.name} {...c} />)}</div>
            <div className="oc-sec__desc" style={{ margin: "22px 0 12px" }}>Ink ladder &amp; hairlines</div>
            <div className="oc-grid oc-grid--auto">{INK_SWATCHES.map((c) => <Swatch key={c.name} {...c} />)}</div>
            <div className="oc-sec__desc" style={{ margin: "22px 0 12px" }}>Surfaces &amp; texture</div>
            <div className="oc-grid oc-grid--auto">{SURFACE_SWATCHES.map((c) => <Swatch key={c.name} {...c} />)}</div>
          </Sec>

          <Sec id="type" eyebrow="Foundations" title="Typography" desc="Brand display + body faces, the Geist numeric face, an Instrument-Serif accent and the added modern Grotesque pairing — switch the whole page from the header.">
            <Card variant="glass">
              {TYPE_SPECIMENS.map((specimen) => <TypeRow key={specimen.sample} {...specimen} />)}
            </Card>
          </Sec>

          <Sec id="icons" eyebrow="Foundations · 67 icons" title="The memory icon system" desc="One mark, a whole icon language — thin fluid lines with solid circular nodes as the connective signature. Adjust size, weight and colour live; click any icon to copy its SVG.">
            <IconExplorer
              query={iconQuery}
              setQuery={setIconQuery}
              size={iconSize}
              setSize={setIconSize}
              weight={iconWeight}
              setWeight={setIconWeight}
              colour={iconColour}
              setColour={setIconColour}
              onCopy={copyIcon}
            />
          </Sec>

          <Sec id="product-icons" eyebrow="Foundations" title="Product stroke icons" desc="The dashboard's own stroke set (currentColor) plus the brand/product marks used across the live surfaces.">
            <div className="oc-grid oc-grid--auto">
              {PRODUCT_ICONS.map(([name, Icon]) => (
                <div className="oc-iconcell" key={name}><Icon size={22} /><span>{name}</span></div>
              ))}
            </div>
          </Sec>

          <Sec id="gauges" eyebrow="Data viz" title="Node gauges" desc="Health rings built from the logo's own primitives — circular nodes, rounded modules and curved arc bridges that fill to each value.">
            <Card variant="glass">
              <div className="oc-rings">
                <NodeRing percent={94} value="94%" title="Memory Index Health" />
                <NodeRing percent={92} value="92%" title="Recall Accuracy" />
                <NodeRing percent={87} value="87%" title="Embedding Coverage" accent />
              </div>
            </Card>
          </Sec>

          <Sec id="vitals" eyebrow="Data viz" title="KPI tiles" desc="Headline counters with brand-native sparklines — points are nodes, the connector a curved bridge, the latest a filled module.">
            <VitalsGrid />
          </Sec>

          <Sec id="heatmap" eyebrow="Data viz" title="Recall heatmap" desc="A honeycomb of topics — brightness is how often each memory was retrieved this week, the single hottest cell lit ember. Hover any cell.">
            <Card variant="glass">
              <RecallHeatmap />
              <div style={{ marginTop: 18 }}><LegendScale /></div>
            </Card>
          </Sec>

          <Sec id="graph" eyebrow="Data viz" title="Knowledge graph" desc="Every connected source orbits the hub; the faint chords are the semantic links the system discovered between them.">
            <Card variant="glass" style={{ display: "grid", placeItems: "center", paddingTop: 26, paddingBottom: 12 }}>
              <SourceGraph />
              <div style={{ fontFamily: "var(--font-ui)", fontSize: 12.5, color: "var(--text-lo)", marginTop: 6 }}>1,204 entities · 3,847 semantic links discovered</div>
            </Card>
          </Sec>

          <Sec id="streak" eyebrow="Data viz · new" title="Activity streak" desc="A contribution-style calendar — 26 weeks of capture activity, intensity scaled by how many memories you added each day.">
            <Card variant="glass"><ActivityCalendar /></Card>
          </Sec>

          <Sec id="composition" eyebrow="Data viz" title="Composition & timeline" desc="What the store is made of (hover to isolate a segment) alongside the live feed of captures, links and syncs.">
            <div className="oc-grid oc-grid--2">
              <Card variant="glass">
                <div className="oc-tile__label" style={{ marginBottom: 16 }}>Memory composition</div>
                <MemoryComposition data={COMPOSITION} />
              </Card>
              <Card variant="glass"><MemoryTimeline /></Card>
            </div>
          </Sec>

          <Sec id="sources" eyebrow="Data viz" title="Source health" desc="Connected integrations with live sync status, last-sync time and item counts — one row mid-sync (ember), one needing a reconnect (coral).">
            <Card variant="glass" style={{ padding: "6px 18px" }}><SourceHealthRows /></Card>
          </Sec>

          <Sec id="buttons" eyebrow="Inputs" title="Buttons" desc="Glass by default; solid white is the primary CTA; ember is the sparing grain-textured accent. Plus the curved clip-path family.">
            <div className="oc-grid oc-grid--3">
              <Demo label="glass · solid · ghost"><Button>Glass</Button><Button variant="solid">Solid</Button><Button variant="ghost">Ghost</Button></Demo>
              <Demo label="ember · danger"><Button variant="ember">Ember</Button><Button variant="danger">Danger</Button></Demo>
              <Demo label="with icons"><Button icon={<Plus size={15} />} variant="solid">New memory</Button><Button iconRight={<ArrowUpRight size={14} />}>Recall</Button></Demo>
              <Demo label="size: sm · md · lg" col start><div className="oc-row"><Button size="sm">Small</Button><Button size="md">Medium</Button><Button size="lg">Large</Button></div></Demo>
              <Demo label="icon buttons"><IconButton aria-label="Search"><Search size={17} /></IconButton><IconButton active aria-label="Grid"><Grid size={17} /></IconButton><IconButton aria-label="Bell"><Bell size={17} /></IconButton></Demo>
              <Demo label="disabled"><Button disabled>Disabled</Button><Button variant="solid" disabled>Disabled</Button></Demo>
              <Demo label="clip-path — chamfer · leaf"><ClipButton shape="chamfer" variant="glass">Chamfer</ClipButton><ClipButton shape="leaf" variant="solid">Leaf</ClipButton></Demo>
              <Demo label="clip-path — folder tab"><ClipButton shape="tab" variant="ember">Folder tab</ClipButton></Demo>
            </div>
          </Sec>

          <Sec id="badges" eyebrow="Inputs" title="Badges & status" desc="Monochrome positive, faint-red negative, plus a sparing accent tone.">
            <div className="oc-grid oc-grid--2">
              <Demo label="tone: neutral · positive · negative · accent">
                <Badge>Indexed</Badge><Badge tone="positive">+1,204</Badge><Badge tone="negative">stale</Badge><Badge tone="accent" icon={<Flame size={11} />}>Hot</Badge>
              </Demo>
              <Demo label="KPI stat usage">
                <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: 40, fontWeight: 500, letterSpacing: "-0.03em", color: "#fff", lineHeight: 1 }}>92%</span>
                  <Badge tone="positive">+2.4</Badge>
                </div>
              </Demo>
            </div>
          </Sec>

          <Sec id="chips" eyebrow="Inputs" title="Chips & tags" desc="Filter pills (glass → solid-white active), removable source tags, and a tag-input that adds on Enter.">
            <div className="oc-grid oc-grid--3">
              <Demo label="filter pills"><Chip active>All</Chip><Chip icon={<Flame size={13} />}>Hot</Chip><Chip>Docs</Chip><Chip>This week</Chip></Demo>
              <Demo label="removable tags">
                {tags.length === 0
                  ? <span style={{ color: "var(--text-faint)", fontSize: 13 }}>all removed</span>
                  : tags.map((tag) => <Chip key={tag} onRemove={() => setTags((current) => current.filter((x) => x !== tag))}>{tag}</Chip>)}
              </Demo>
              <Demo label="tag input — new" col start><TagInput /></Demo>
            </div>
          </Sec>

          <Sec id="inputs" eyebrow="Inputs" title="Text fields" desc="Frosted glass fields with label, leading icon, focus and error states.">
            <div className="oc-grid oc-grid--3">
              <Demo label="text input" col start><Input label="Workspace name" placeholder="Second brain" /></Demo>
              <Demo label="with icon" col start><Input label="Search" icon={<Search size={16} />} placeholder="Search memories…" /></Demo>
              <Demo label="error state" col start><Input label="Source URL" defaultValue="not-a-url" error="Enter a valid URL." /></Demo>
              <Demo label="textarea" col start><Textarea label="Note" placeholder="Capture a thought to remember…" /></Demo>
            </div>
          </Sec>

          <Sec id="controls" eyebrow="Inputs" title="Controls" desc="Switch and segmented control, plus the new checkbox, radio group and range slider.">
            <div className="oc-grid oc-grid--3">
              <Demo label="switch" col><div className="oc-row"><Switch checked={pushOn} onChange={setPushOn} label="Auto-ingest" /><Switch checked={betaOn} onChange={setBetaOn} label="Beta recall" /></div></Demo>
              <Demo label="segmented" col><Segmented value={tab} onChange={setTab} options={[{ value: "overview", label: "Overview" }, { value: "specs", label: "Specs" }, { value: "usage", label: "Usage" }]} /></Demo>
              <Demo label="range slider — new" col><OcSlider /></Demo>
              <Demo label="checkbox — new" col start>
                <OcCheckbox checked={checks.has("docs")} onChange={() => toggleCheck("docs")} label="Documents" />
                <OcCheckbox checked={checks.has("convos")} onChange={() => toggleCheck("convos")} label="Conversations" />
                <OcCheckbox checked={checks.has("web")} onChange={() => toggleCheck("web")} label="Web clips" />
              </Demo>
              <Demo label="radio group — new" col start>
                <OcRadioGroup value={radio} onChange={setRadio} options={[{ value: "semantic", label: "Semantic recall" }, { value: "keyword", label: "Keyword match" }, { value: "hybrid", label: "Hybrid" }]} />
              </Demo>
              <Demo label="selected" col><span style={{ color: "var(--text-mid)", fontSize: 13, fontFamily: "var(--font-ui)" }}>tab → <b style={{ color: "#fff" }}>{tab}</b> · mode → <b style={{ color: "#fff" }}>{radio}</b></span></Demo>
            </div>
          </Sec>

          <Sec id="meters" eyebrow="Inputs" title="Meters" desc="Discrete dot meter (recall frequency) and continuous progress, mono and accent.">
            <div className="oc-grid oc-grid--3">
              <Demo label="dot meter 1 → 5" col><div className="oc-stack">{[1, 2, 3, 4, 5].map((n) => <DotMeter key={n} value={n} />)}</div></Demo>
              <Demo label="progress (mono)" col><BarMeter value={64} label="Indexing" /></Demo>
              <Demo label="progress (accent)" col><BarMeter value={92} accent label="Recall rate" /></Demo>
            </div>
          </Sec>

          <Sec id="tabs" eyebrow="Navigation · new" title="Tabs" desc="A glass tab strip with a sliding ink underline that animates to the active tab.">
            <Tabs />
          </Sec>
          <Sec id="breadcrumbs" eyebrow="Navigation · new" title="Breadcrumbs" desc="Space → folder → memory trail with node-chevron separators.">
            <Card variant="glass"><Breadcrumbs /></Card>
          </Sec>
          <Sec id="pagination" eyebrow="Navigation · new" title="Pagination" desc="Numbered pager with prev/next and a solid-white active page.">
            <Card variant="glass" style={{ display: "flex", justifyContent: "center" }}><Pagination /></Card>
          </Sec>
          <Sec id="steps" eyebrow="Navigation · new" title="Stepper" desc="Onboarding progress — done steps fill ember, the active step glows. Click a step or use the controls.">
            <Card variant="glass"><Stepper /></Card>
          </Sec>
          <Sec id="tree" eyebrow="Navigation · new" title="Tree / explorer" desc="Collapsible space → folder → memory hierarchy with rotating chevrons.">
            <Tree />
          </Sec>

          <Sec id="alerts" eyebrow="Feedback · new" title="Alerts & callouts" desc="Four tones — info, success, warning, error — each tinted only on its icon and hairline.">
            <div className="oc-stack">{ALERTS.map((alert) => <Alert key={alert.tone} {...alert} />)}</div>
          </Sec>
          <Sec id="toasts" eyebrow="Feedback" title="Notification toasts" desc="Confirmations, busy and failure states — emit an event to watch one auto-dismiss with a progress bar.">
            <ActivityToast />
          </Sec>
          <Sec id="overlays" eyebrow="Feedback · new" title="Tooltip & popover" desc="A CSS hover/focus tooltip and a click popover that closes on outside-click.">
            <div className="oc-grid oc-grid--2">
              <Demo label="tooltip (hover or focus)"><Tip label="Retrieved 38× this week"><Button variant="glass" icon={<Flame size={15} />}>Hover me</Button></Tip></Demo>
              <Demo label="popover menu"><Popover /></Demo>
            </div>
          </Sec>
          <Sec id="accordion" eyebrow="Feedback · new" title="Accordion" desc="Disclosure rows with a smooth grid-row height animation — one open at a time.">
            <Accordion />
          </Sec>
          <Sec id="empty" eyebrow="Feedback · new" title="Empty state" desc="The graceful zero-result — an icon, a reason, and the one action that resolves it.">
            <Card variant="glass"><EmptyState /></Card>
          </Sec>
          <Sec id="skeleton" eyebrow="Feedback" title="Skeleton loaders" desc="The shimmer shown while memories embed and the graph rebuilds.">
            <MemorySkeletons />
          </Sec>

          <Sec id="table" eyebrow="Display" title="Memory table" desc="The dense, sortable ledger — a recall leaderboard with inline heat dots and link counts. Hover a row for actions.">
            <Card variant="glass"><MemoryTable /></Card>
          </Sec>
          <Sec id="cmdk" eyebrow="Display" title="Command palette" desc="Ask your memory anything — ⌘K from anywhere; arrow keys navigate, enter opens, esc closes.">
            <Demo label="press ⌘K or the button"><Button variant="solid" icon={<Search size={15} />} onClick={() => setCmdkOpen(true)}>Open command palette</Button><div className="oc-row" style={{ marginLeft: 8 }}><Kbd>⌘</Kbd><Kbd>K</Kbd></div></Demo>
          </Sec>
          <Sec id="avatars" eyebrow="Display" title="Avatars" desc="Image with initials fallback, sizes, and overlapping stacks.">
            <div className="oc-grid oc-grid--3">
              <Demo label="sizes 24 / 32 / 48"><Avatar name="Ann" src={av(1)} size={24} /><Avatar name="Bea" src={av(5)} size={32} /><Avatar name="Cleo" src={av(9)} size={48} /></Demo>
              <Demo label="initials fallback"><Avatar name="Jane Doe" size={40} /><Avatar name="Wade Warren" size={40} /><Avatar name="Peter Thomas" size={40} /></Demo>
              <Demo label="stack"><AvatarStack people={[{ name: "C", src: av(3) }, { name: "D", src: av(4) }, { name: "E", src: av(6) }]} size={34} /></Demo>
            </div>
          </Sec>
          <Sec id="code" eyebrow="Display · new" title="Code block" desc="A monospace block with window chrome and a copy button — for docs and snippets.">
            <CodeBlock />
          </Sec>

          <Sec id="cards" eyebrow="Surfaces" title="Cards & materials" desc="Three materials: frosted dark glass, light paper glass, and the deep grain-textured ember.">
            <div className="oc-grid oc-grid--3">
              <Card variant="glass">
                <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 500, marginBottom: 6 }}>Glass</div>
                <p style={{ fontSize: 13, color: "var(--ink-dim)", lineHeight: 1.5 }}>Frosted dark surface that blurs the grainy backdrop. The default content card.</p>
              </Card>
              <Card variant="paper">
                <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 500, marginBottom: 6 }}>Paper</div>
                <p style={{ fontSize: 13, color: "#5c5c56", lineHeight: 1.5 }}>Light frosted glass with dark text — summary &amp; document surfaces use this.</p>
              </Card>
              <Card variant="ember">
                <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 500, marginBottom: 6 }}>Ember</div>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,.85)", lineHeight: 1.5 }}>The one accent surface — deep, opaque, textured with film grain.</p>
              </Card>
            </div>
          </Sec>

          <Sec id="memory-cards" eyebrow="Surfaces · clip-path" title="Memory record cards" desc="The signature corner-notch silhouette — clipped to a JS-computed path() so the floating buttons nestle inside the notch.">
            <div className="cardrow">{MEMORY_CARDS.map((memory) => <MemoryCard key={memory.title} memory={memory} />)}</div>
          </Sec>

          <Sec id="panels" eyebrow="Surfaces · clip-path" title="Folder panels" desc="One floating-folder silhouette — body and tab, both path() clips — doing four jobs: a ⌘K recall, a capture dropzone, a daily digest and a space.">
            <div className="oc-panels"><RecallPanel /><CapturePanel /><DigestPanel /><SpacePanel /></div>
          </Sec>

          <Sec id="header" eyebrow="Surfaces · clip-path" title="Workspace header" desc="Display wordmark with the inline target glyph, the white primary action and the KPI stat band.">
            <WorkspaceHeader />
          </Sec>

          <Sec id="schedule" eyebrow="Surfaces · clip-path" title="Schedule bar" desc="Light paper-glass timeline; the active slot's tab uses a clip-path for its downward pointer.">
            <ScheduleBar />
          </Sec>
        </main>
      </div>

      <CommandPalette open={cmdkOpen} onClose={() => setCmdkOpen(false)} />
      <RadialMenu open={dialOpen} onClose={() => setDialOpen(false)} />
      <button className="dial-fab" aria-label="Open quick dial" onClick={() => setDialOpen(true)}><Menu size={24} /></button>
      <div className={"oc-copytoast" + (copied ? " show" : "")}><i />{copied ? `Copied ${copied}.svg` : ""}</div>
    </div>
  );
}
