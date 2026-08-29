# Metacognition — component library

A dark, glass-and-grain design system for a memory product, plus the dashboard it was
extracted from. React 18 + Vite + TypeScript, and a hand-rolled router — no UI dependencies.


<img width="1511" height="822" alt="Screenshot 2026-07-23 at 10 00 31 PM" src="https://github.com/user-attachments/assets/3fe2b145-9d4a-4d01-8179-51886159261d" />


<img width="1494" height="824" alt="Screenshot 2026-07-23 at 9 59 18 PM" src="https://github.com/user-attachments/assets/255522af-1837-4250-8404-b29dc2bf85ba" />




```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck, then bundle to dist/
npm run preview  # serve the built bundle
```

Two routes:

| Route | What it is |
| --- | --- |
| `/` and `/components` | The component library. Every component, live, with its variants |
| `/dashboard` | The real product screen the system was pulled out of |

The library is the front door on purpose — it's the fastest way to see what exists before
you build with it.

---

## Start here

Open `/components` and use it as the reference. Everything on that page is rendered from the
same code you'd import, so if it looks right there, it will look right in your screen. The
sticky table of contents on the left maps to the sections below.

Everything is imported by path — there's no barrel export at the root:

```tsx
import { Button, IconButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MemoryIcon } from "@/lib/memory-icons";
```

(Those `@/` paths are illustrative — the codebase uses relative imports today.)

## The one rule that will bite you

**Stylesheet order in `src/main.tsx` is load-bearing.** The `oc-*` classes layer on top of the
`ui-*` primitives, and a lot of pairs land at equal CSS specificity, where source order alone
decides the winner. The imports are declared in one place, in a deliberate order:

```tsx
import "./styles/optimized-components/oc.tailwind.css";
import "./styles/optimized-components/oc.css";
import "./styles/fonts.css";
import "./styles/index.css";
import "./styles/surfaces.css";
import "./styles/dial.css";
import "./styles/ui.css";
import "./app/styles/app-shell.css";
import "./app/styles/dashboard.css";
```

Don't reorder it, and don't `import "…css"` from inside a component or page — that hands the
order back to the module graph, which is how it silently broke once before. There's more detail
in [`src/styles/optimized-components/README.md`](src/styles/optimized-components/README.md).

---

## Buttons

`variant` sets the tone, `size` sets the box. Defaults are `glass` / `md`, which is what you
want most of the time.

```tsx
<Button>Recall</Button>
<Button variant="solid" icon={<Plus size={15} />}>New memory</Button>
<Button variant="ember" size="lg">Capture</Button>
<Button variant="danger" disabled>Delete</Button>
<Button variant="ghost" iconRight={<ArrowUpRight size={14} />}>Open</Button>
<Button block>Full width</Button>
```

| Prop | Values |
| --- | --- |
| `variant` | `glass` · `solid` · `ghost` · `ember` · `danger` |
| `size` | `sm` (32px) · `md` (38px) · `lg` (46px) |
| `icon` / `iconRight` | any node — pass an icon at the size noted below |
| `block` | stretches to the container |

Use `ember` sparingly. The accent orange is a scalpel, not a highlighter — one per screen is
usually one too many already.

For a square icon-only button, `IconButton` takes a pixel `size` rather than a token:

```tsx
<IconButton size={28} aria-label="Open"><ArrowUpRight size={14} /></IconButton>
<IconButton active aria-label="Grid"><Grid size={17} /></IconButton>
```

Always give `IconButton` an `aria-label`. There's no text to fall back on.

### Clip-path buttons

Three silhouettes cut out of the button box — a chamfered corner, and two mirrored
"leaf"/"tab" shapes:

```tsx
<ClipButton shape="chamfer" variant="glass">Chamfer</ClipButton>
<ClipButton shape="leaf" variant="solid">Leaf</ClipButton>
<ClipButton shape="tab" variant="ember">Folder tab</ClipButton>
```

The geometry comes from `clipShapes.ts`, which generates the path from the box dimensions and
feeds it to *both* the CSS `clip-path` and the SVG edge stroke. If you ever need a different
size, change `CLIP_BUTTON_SIZE` — don't hand-write a path, and don't set the height in CSS.
The two used to be separate copies at different sizes, and the result was a fill and an outline
that didn't line up.

## Cards and surfaces

```tsx
<Card>Glass — the default. Blurred, faintly lit, grain overlay.</Card>
<Card variant="paper">Paper — light surface, dark ink. For contrast moments.</Card>
<Card variant="ember">Ember — the accent gradient. Use once.</Card>
```

`Card` passes through every `div` prop, so `style`, `onClick` and `className` all work as you'd
expect for layout tweaks.

## Inputs and controls

```tsx
<Input label="Search icons" icon={<Search size={16} />} placeholder="memory, graph, sync…" />
<Input label="Email" error="That address doesn't look right" />
<Textarea label="Notes" rows={4} />

<Segmented value={range} onChange={setRange} options={[
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
]} />

<Switch checked={on} onChange={setOn} label="Auto-index new captures" />
```

`Input` builds its own `id` from `label` and wires up the `htmlFor`, so a label alone gives you
a working click target. Pass an explicit `id` if you need to control it.

`Segmented` is generic over its value type — `Segmented<"7d" | "30d">` infers from `options`, so
a typo in `value` is a compile error rather than a silently dead tab.

## Badges, chips, meters

```tsx
<Badge>Indexed</Badge>
<Badge tone="positive">+1,204</Badge>
<Badge tone="negative">stale</Badge>
<Badge tone="accent" icon={<Flame size={11} />}>Hot</Badge>

<Chip active onClick={toggle}>pricing</Chip>
<Chip onRemove={() => drop("auth")}>auth</Chip>

<DotMeter value={4} />              {/* out of 5 by default */}
<BarMeter value={92} label="Recall rate" accent />
```

`Chip` renders a `<button>` normally, but switches to a `<span>` with its own remove button when
you pass `onRemove` — a button inside a button isn't valid HTML.

Tones are monochrome by design: `positive` and `negative` are weight and opacity, not green and
red. `accent` is the only one that brings colour.

## Icons

Two sets, and they're not interchangeable.

**`MemoryIcon`** — 68 product icons drawn on a 24px grid, addressed by name:

```tsx
<MemoryIcon name="logo-mark" size={24} weight={1.75} />
<MemoryIcon name="check" size={12} weight={2.8} />
```

`weight` is the stroke width. Nudge it up as the icon gets smaller — a 1.75 stroke that reads
well at 24px goes thin and washed-out at 12px. They're grouped into six categories:

| Category | Count | What lives there |
| --- | --- | --- |
| Brand | 8 | Marks that reuse the node + bridge motif |
| Navigation | 11 | Primary sidebar destinations |
| People | 4 | Members, teams, identity |
| Actions | 18 | Verbs the user performs on a memory |
| System | 17 | Data, settings, account, status |
| UI | 10 | Chrome, controls, layout |

Browse and search them in the **Foundations → Icons** section of `/components`; clicking a cell
copies its SVG. `memoryIconSvg(name, weight)` is what does that, if you need the markup
elsewhere.

To add one, drop it into the right category file under `src/lib/memory-icons/` — one SVG
element per line, `currentColor` for fills:

```ts
export const ACTION_ICONS = defineIcons("Actions", {
  "pin": {
    label: "Pin",
    paths: [
      '<path d="M12 3v8"/>',
      '<circle cx="12" cy="14" r="3"/>',
    ],
  },
});
```

`defineIcons` attaches the category and joins the paths, so you never repeat `cat:` by hand.
Set `hero: true` to feature it in the gallery grid.

**`components/icons.tsx`** — 30 interface icons (`Search`, `Bell`, `ChevronDown`, `Close`…) as
plain components taking a `size`. Use these for chrome; use `MemoryIcon` for anything that
represents a memory, a source or an action on one.

## Data visualisation

All of these are self-contained and responsive — hand them data, give them a container:

```tsx
<ActivityGraph points={points} primaryLabel="Recalls" secondaryLabel="Captures" height={290} />
<NodeSparkline data={[4, 9, 6, 12, 8]} accent />
<NodeRing percent={92} value="92%" title="Recall rate" />
<MemoryComposition data={slices} />
<ActivityCalendar weeks={26} />
<RecallHeatmap />
<LegendScale />
```

`ActivityGraph` takes `{ label, tick, primary, secondary? }` per point and animates between
datasets, so swapping `points` morphs rather than snapping.

`NodeSparkline` has two weights via `tone`: `bold` (the default, for hero cards) and `fine`
(thinner stroke, lighter fill, for dense grids). Same component, same data — pick by context.

---

## Adding a component

1. Build it in `src/components/ui/` (or `viz/` if it renders data). Props go in the signature
   with defaults, not in a separate interface unless it's genuinely long.
2. Style it in `src/styles/ui.css` with a `ui-` prefixed class. Gallery-only styling belongs in
   `src/styles/optimized-components/oc/`, in whichever part file matches the section.
3. Add it to the matching section in `src/pages/optimized-components/` so it shows up in the
   library with its variants.
4. `npm run build` — the build typechecks first, so a broken prop type fails there.

### Where things live

```
src/
  components/ui/       buttons, cards, inputs, badges, chips, meters
  components/viz/      graphs, rings, heatmaps, sparklines
  components/icons.tsx interface icons
  lib/memory-icons/    the 68 product icons, one file per category
  lib/router.tsx       pushState + a custom event. That's the whole router
  lib/routes.ts        route strings — add new ones here, not inline
  pages/optimized-components/   the library itself, section per file
  app/                 the dashboard: shell, sidebar, dashboard sections
  styles/              tokens, fonts, primitives
  styles/optimized-components/  the library's own two-layer stylesheet
```

### Tokens

Colour, type and radius all come from CSS custom properties in `src/styles/index.css` and
`src/styles/fonts.css`. Reach for those before writing a literal:

```
--accent --hot                     the orange
--text-hi --text-mid --text-lo     ink ladder
--rule --rule-strong --stroke      hairlines
--card --card-2 --pill --sunken    surfaces
--glass-card --glass-blur --grain-tex
--font-display --font-body --font-ui --font-sans --font-serif --font-mono
--r-card --r-pill
```

The **Foundations** section of `/components` renders every swatch and type specimen with its
token name, which is usually faster than reading the CSS.

### Tailwind

Tailwind is on, but with `preflight` disabled and only used through `@apply` in
`oc.tailwind.css` — the split is by whole rule, never per-declaration. The rest of the app is
hand-written CSS and stays that way. If you're adding a rule that's purely layout
(flex/grid/gap/padding/position), it can go in the Tailwind layer; anything with colour,
borders, gradients or animation goes in the plain layer.
