import type { CSSProperties, ReactNode } from "react";
import { Input } from "../../components/ui/Input";
import { Segmented } from "../../components/ui/Segmented";
import { Search } from "../../components/icons";
import {
  Bell, Calendar, CalDays, ArrowUpRight, ArrowLeft, Plus, Target, Flame,
  Sliders, Mail, Video, Mic, Speaker, PhoneHangup, ChevronDown, Download, Edit,
  DocThumb, Grid, Contacts, Chat, Menu, Cog, Board, ListChecks, Globe, Close,
   Expand, HubSpot,
} from "../../components/icons";
import { MEMORY_CATEGORIES, MEMORY_ICONS, MemoryIcon, iconNamesByCategory } from "../../lib/memory-icons";

export const BRAND_SWATCHES = [
  { name: "Black (shell)", value: "#000000" },
  { name: "Orange (accent)", value: "#ff6b3e" },
  { name: "Ember deep", value: "#b83313" },
  { name: "Ember darker", value: "#5f1a04" },
  { name: "Red-orange", value: "#fa2d00" },
  { name: "Error coral", value: "#ffb4a1" },
  { name: "Paper", value: "#f3f3f1" },
];

export const INK_SWATCHES = [
  { name: "ink", value: "rgba(255,255,255,.92)" },
  { name: "ink-dim", value: "rgba(255,255,255,.62)" },
  { name: "ink-dimmer", value: "rgba(255,255,255,.42)" },
  { name: "faint", value: "rgba(255,255,255,.30)" },
  { name: "rule", value: "rgba(255,255,255,.12)" },
  { name: "glass-chip", value: "rgba(255,255,255,.05)" },
];

export const SURFACE_SWATCHES = [
  { name: "card", value: "#161616" },
  { name: "card-2", value: "#1e1e1e" },
  { name: "pill", value: "#18181a" },
  { name: "glass card", value: "var(--glass-card)", css: "var(--glass-card)" },
  { name: "ember", value: "linear ember", css: "linear-gradient(155deg,#b83313,#5f1a04)" },
  { name: "grain", value: "--grain-tex", css: "#1a1a1a var(--grain-tex)" },
];

export const PRODUCT_ICONS: [string, (p: { size?: number }) => ReactNode][] = [
  ["Search", Search], ["Bell", Bell], ["Calendar", Calendar], ["CalDays", CalDays],
  ["ArrowUpRight", ArrowUpRight], ["ArrowLeft", ArrowLeft], ["Plus", Plus], ["Target", Target],
  ["Flame", Flame], ["Sliders", Sliders], ["Mail", Mail], ["Video", Video], ["Mic", Mic],
  ["Speaker", Speaker], ["PhoneHangup", PhoneHangup], ["ChevronDown", ChevronDown],
  ["Download", Download], ["Edit", Edit], ["DocThumb", DocThumb], ["Grid", Grid],
  ["Contacts", Contacts], ["Chat", Chat], ["Menu", Menu], ["Cog", Cog], ["Board", Board],
  ["ListChecks", ListChecks], ["Globe", Globe], ["Close", Close],
  ["Expand", Expand], ["HubSpot", HubSpot],
];

export const TYPE_SPECIMENS: { sample: string; style: CSSProperties; meta: string[] }[] = [
  {
    sample: "Metacognition",
    style: { fontFamily: "var(--font-display)", fontSize: 52, fontWeight: 500, letterSpacing: "-0.03em", lineHeight: 1 },
    meta: ["--font-display", "display", "600 · -0.03em"],
  },
  {
    sample: "The quick brown fox recalls a lazy memory.",
    style: { fontFamily: "var(--font-body)", fontSize: 18, lineHeight: 1.55 },
    meta: ["--font-body", "18 / 1.55"],
  },
  {
    sample: "UI · LABEL · EYEBROW",
    style: { fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink-dim)" },
    meta: ["--font-ui", "0.16em"],
  },
  {
    sample: "48,210  +1,204  92%  4.2 h",
    style: { fontFamily: "var(--font-sans)", fontSize: 24, fontWeight: 500, letterSpacing: "-0.02em" },
    meta: ["--font-sans", "numerics"],
  },
  {
    sample: "a scalpel for accent words",
    style: { fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 26, color: "#ff9c7a" },
    meta: ["--font-serif", "italic"],
  },
  {
    sample: "memory_index · retrieval_latency · 12ms",
    style: { fontFamily: "var(--font-mono)", fontSize: 13, letterSpacing: "0.01em", color: "var(--ink-dim)" },
    meta: ["--font-mono", "data labels"],
  },
];

export function Swatch({ name, value, css }: { name: string; value: string; css?: string }) {
  return (
    <div className="oc-swatch">
      <div className="oc-swatch__chip" style={{ background: css ?? value }} />
      <div className="oc-swatch__meta">
        <div className="oc-swatch__name">{name}</div>
        <div className="oc-swatch__val">{value}</div>
      </div>
    </div>
  );
}

export function TypeRow({ sample, style, meta }: { sample: string; style: CSSProperties; meta: string[] }) {
  return (
    <div className="oc-type">
      <div className="oc-type__sample" style={style}>{sample}</div>
      <div className="oc-type__meta">{meta.map((entry) => <span key={entry}>{entry}</span>)}</div>
    </div>
  );
}

const ICON_SIZES = ["20", "24", "30", "40"];
const ICON_WEIGHTS = ["1.25", "1.5", "1.75", "2"];
const ICON_COLOURS = [
  { colour: "var(--text-hi)", preview: "linear-gradient(135deg,#fff 50%,#111 50%)", title: "Ink" },
  { colour: "#ff6b3e", preview: "#ff6b3e", title: "Ember" },
  { colour: "#7da2ff", preview: "#7da2ff", title: "Blue" },
  { colour: "#5ad19a", preview: "#5ad19a", title: "Green" },
];

export interface IconExplorerState {
  query: string;
  setQuery: (value: string) => void;
  size: string;
  setSize: (value: string) => void;
  weight: string;
  setWeight: (value: string) => void;
  colour: string;
  setColour: (value: string) => void;
  onCopy: (name: string) => void;
}

function matchingIconGroups(query: string) {
  const needle = query.trim().toLowerCase();

  const matches = (name: string, cat: string) => (
    !needle
    || name.includes(needle)
    || MEMORY_ICONS[name].label.toLowerCase().includes(needle)
    || cat.toLowerCase().includes(needle)
  );

  return MEMORY_CATEGORIES
    .map(({ id, description }) => ({
      cat: id,
      description,
      names: iconNamesByCategory(id).filter((name) => matches(name, id)),
    }))
    .filter((group) => group.names.length);
}

export function IconExplorer(state: IconExplorerState) {
  const groups = matchingIconGroups(state.query);

  return (
    <>
      <div className="oc-icons__bar">
        <Input
          label="Search icons"
          icon={<Search size={16} />}
          placeholder="memory, graph, sync…"
          value={state.query}
          onChange={(e) => state.setQuery(e.target.value)}
        />
        <div className="oc-icons__ctrl">
          <span className="oc-icons__ctrllbl">Size</span>
          <Segmented value={state.size} onChange={state.setSize} options={ICON_SIZES.map((s) => ({ value: s, label: s }))} />
        </div>
        <div className="oc-icons__ctrl">
          <span className="oc-icons__ctrllbl">Weight</span>
          <Segmented value={state.weight} onChange={state.setWeight} options={ICON_WEIGHTS.map((w) => ({ value: w, label: w }))} />
        </div>
        <div className="oc-icons__ctrl">
          <span className="oc-icons__ctrllbl">Colour</span>
          <div className="oc-sw">
            {ICON_COLOURS.map((option) => (
              <button
                key={option.title}
                className={"oc-sw__b" + (state.colour === option.colour ? " is-on" : "")}
                style={{ background: option.preview }}
                title={option.title}
                aria-label={option.title}
                onClick={() => state.setColour(option.colour)}
              />
            ))}
          </div>
        </div>
      </div>

      {groups.length === 0 && (
        <div className="oc-empty-note" style={{ padding: "40px 0" }}>No icons match “{state.query}”.</div>
      )}

      {groups.map((group) => (
        <div className="oc-icons__cat" key={group.cat}>
          <div className="oc-icons__cathead">
            <span className="oc-icons__catname">{group.cat}</span>
            <span className="oc-icons__catcount">{group.names.length}</span>
            <span className="oc-icons__catdesc">{group.description}</span>
          </div>
          <div
            className="oc-icons__grid"
            style={{ ["--oc-icon-size" as string]: state.size + "px", ["--oc-icon-color" as string]: state.colour } as CSSProperties}
          >
            {group.names.map((name) => (
              <button
                key={name}
                className={"oc-icons__cell" + (MEMORY_ICONS[name].hero ? " oc-icons__cell--hero" : "")}
                title={`Click to copy ${name}.svg`}
                onClick={() => state.onCopy(name)}
              >
                <MemoryIcon name={name} size={parseInt(state.size, 10)} weight={parseFloat(state.weight)} />
                <span className="oc-icons__nm">{name}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
