export interface SectionGroup {
  group: string;
  items: { id: string; label: string }[];
}

export const SECTION_GROUPS: SectionGroup[] = [
  {
    group: "Foundations",
    items: [
      { id: "colour", label: "Colour" },
      { id: "type", label: "Typography" },
      { id: "icons", label: "Icon system" },
      { id: "product-icons", label: "Product icons" },
    ],
  },
  {
    group: "Data viz",
    items: [
      { id: "gauges", label: "Node gauges" },
      { id: "vitals", label: "KPI tiles" },
      { id: "heatmap", label: "Recall heatmap" },
      { id: "graph", label: "Knowledge graph" },
      { id: "streak", label: "Activity streak" },
      { id: "composition", label: "Composition" },
      { id: "sources", label: "Source health" },
    ],
  },
  {
    group: "Inputs",
    items: [
      { id: "buttons", label: "Buttons" },
      { id: "badges", label: "Badges" },
      { id: "chips", label: "Chips & tags" },
      { id: "inputs", label: "Inputs" },
      { id: "controls", label: "Controls" },
      { id: "meters", label: "Meters" },
    ],
  },
  {
    group: "Navigation",
    items: [
      { id: "tabs", label: "Tabs" },
      { id: "breadcrumbs", label: "Breadcrumbs" },
      { id: "pagination", label: "Pagination" },
      { id: "steps", label: "Stepper" },
      { id: "tree", label: "Tree" },
    ],
  },
  {
    group: "Feedback",
    items: [
      { id: "alerts", label: "Alerts" },
      { id: "toasts", label: "Toasts" },
      { id: "overlays", label: "Tooltip & popover" },
      { id: "accordion", label: "Accordion" },
      { id: "empty", label: "Empty state" },
      { id: "skeleton", label: "Skeletons" },
    ],
  },
  {
    group: "Display",
    items: [
      { id: "table", label: "Table" },
      { id: "cmdk", label: "Command palette" },
      { id: "avatars", label: "Avatars" },
      { id: "code", label: "Code block" },
    ],
  },
  {
    group: "Surfaces",
    items: [
      { id: "cards", label: "Cards" },
      { id: "memory-cards", label: "Memory cards" },
      { id: "panels", label: "Folder panels" },
      { id: "header", label: "Workspace header" },
      { id: "schedule", label: "Schedule bar" },
    ],
  },
];

export const SECTION_IDS = SECTION_GROUPS.flatMap((group) => group.items.map((item) => item.id));
