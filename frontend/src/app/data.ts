export type SyncState = "ok" | "sync" | "fail";

export type MemoryGlyph =
  | "document" | "note" | "chat" | "globe" | "folder" | "user"
  | "calendar" | "api" | "embed" | "idea" | "brain";

export interface Kpi {
  id: string;
  label: string;
  value: string;
  delta: string;
  data: number[];
  icon: string;
  caption: string;
  accent?: boolean;
}

export const KPIS: Kpi[] = [
  {
    id: "tokens", label: "Token Usage", value: "1.84M", delta: "+12%", icon: "analytics",
    caption: "of 4M monthly budget", data: [62, 70, 66, 78, 84, 80, 92, 104, 118, 124, 131, 142],
  },
  {
    id: "chats", label: "Active Chats", value: "312", delta: "+18", icon: "chat",
    caption: "across 9 workspaces", data: [120, 180, 150, 210, 240, 230, 280, 296, 300, 305, 308, 312],
  },
  {
    id: "memories", label: "Memories", value: "48,210", delta: "+1,204", icon: "memory",
    caption: "indexed & searchable", data: [30, 32, 31, 35, 38, 42, 41, 46, 47, 47, 48, 48],
  },
  {
    id: "recall", label: "Recall Rate", value: "92%", delta: "+2.4", icon: "ai-spark", accent: true,
    caption: "answer-with-citation rate", data: [82, 84, 83, 86, 88, 87, 90, 91, 91, 92, 92, 92],
  },
];

export type ActivityRangeId = "today" | "7d" | "30d";

export interface ActivityRange {
  labels: string[];
  ticks: string[];
  recalls: number[];
  captures: number[];
  delta: string;
  vs: string;
}

const HOURS = Array.from({ length: 24 }, (_, hour) => {
  const twelveHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelveHour} ${hour < 12 ? "AM" : "PM"}`;
});

const LAST_30_DAYS = [
  "May 12", "May 13", "May 14", "May 15", "May 16", "May 17", "May 18",
  "May 19", "May 20", "May 21", "May 22", "May 23", "May 24", "May 25",
  "May 26", "May 27", "May 28", "May 29", "May 30", "May 31", "Jun 1",
  "Jun 2", "Jun 3", "Jun 4", "Jun 5", "Jun 6", "Jun 7", "Jun 8", "Jun 9", "Jun 10",
];

export const ACTIVITY_SERIES: Record<ActivityRangeId, ActivityRange> = {
  today: {
    labels: HOURS.map((hour) => `Today · ${hour}`),
    ticks: HOURS,
    recalls: [12, 9, 7, 6, 8, 14, 26, 44, 68, 92, 110, 124, 118, 131, 142, 156, 148, 132, 108, 86, 64, 48, 33, 22],
    captures: [5, 4, 3, 3, 6, 10, 22, 38, 54, 61, 58, 52, 44, 49, 56, 62, 58, 49, 41, 52, 58, 44, 28, 14],
    delta: "+8%", vs: "vs yesterday",
  },
  "7d": {
    labels: ["Thu, Jun 4", "Fri, Jun 5", "Sat, Jun 6", "Sun, Jun 7", "Mon, Jun 8", "Tue, Jun 9", "Today"],
    ticks: ["Thu 4", "Fri 5", "Sat 6", "Sun 7", "Mon 8", "Tue 9", "Today"],
    recalls: [712, 798, 486, 412, 864, 926, 1038],
    captures: [388, 412, 220, 196, 458, 502, 540],
    delta: "+18%", vs: "vs last week",
  },
  "30d": {
    labels: LAST_30_DAYS,
    ticks: LAST_30_DAYS,
    recalls: [
      524, 548, 512, 580, 612, 438, 396, 642, 668, 701, 728, 754, 489, 442,
      786, 802, 775, 841, 872, 538, 486, 868, 912, 884, 938, 964, 592, 544, 992, 1038,
    ],
    captures: [
      284, 296, 270, 302, 318, 224, 201, 332, 348, 361, 374, 388, 246, 228,
      402, 419, 398, 430, 452, 275, 248, 446, 468, 452, 481, 502, 301, 278, 512, 540,
    ],
    delta: "+24%", vs: "vs previous 30 days",
  },
};

export const ACTIVITY_RANGE_CAPTIONS: Record<ActivityRangeId, string> = {
  today: "Hourly · today",
  "7d": "Daily · last 7 days",
  "30d": "Daily · last 30 days",
};

export interface Connector {
  id: string;
  name: string;
  icon: string;
  status: SyncState;
  statusLabel: string;
  sub: string;
  items: number;
}

export const CONNECTORS: Connector[] = [
  { id: "slack", name: "Slack", icon: "chat", status: "ok", statusLabel: "Healthy", sub: "synced 4m ago", items: 3201 },
  { id: "jira", name: "Jira", icon: "api", status: "sync", statusLabel: "Syncing", sub: "indexing 142 issues", items: 1880 },
  { id: "x", name: "X", icon: "globe", status: "ok", statusLabel: "Healthy", sub: "synced 1h ago", items: 612 },
  { id: "drive", name: "Google Drive", icon: "folder", status: "ok", statusLabel: "Healthy", sub: "synced 18m ago", items: 842 },
  { id: "notion", name: "Notion", icon: "note", status: "ok", statusLabel: "Healthy", sub: "synced 2m ago", items: 1204 },
  { id: "web", name: "Web Clipper", icon: "globe", status: "fail", statusLabel: "Reconnect", sub: "token expired", items: 318 },
];

export interface QuickAction {
  id: string;
  icon: string;
  title: string;
  sub: string;
  primary?: boolean;
}

export const QUICK_ACTIONS: QuickAction[] = [
  { id: "add", icon: "upload", title: "Add Resource", sub: "Drop a file, paste a URL or note", primary: true },
  { id: "infer", icon: "ai-spark", title: "Infer Notes", sub: "Extract memories from raw text" },
  { id: "connect", icon: "connector", title: "Connect Source", sub: "Add a new integration" },
  { id: "invite", icon: "user-add", title: "Invite Member", sub: "Share a workspace" },
];

export interface ChatModel {
  id: string;
  label: string;
  hint: string;
}

export const MODELS: ChatModel[] = [
  { id: "opus", label: "Claude Opus 4.8", hint: "deepest reasoning" },
  { id: "sonnet", label: "Claude Sonnet 4.6", hint: "fast & balanced" },
  { id: "haiku", label: "Claude Haiku 4.5", hint: "instant" },
];

export interface Memory {
  title: string;
  source: string;
  icon: MemoryGlyph;
  excerpt: string;
  tags: string[];
  recalls: number;
}

export const FEATURED_MEMORY: Memory = {
  title: "Series-B data-room notes",
  source: "Drive",
  icon: "document",
  recalls: 5,
  tags: ["finance", "diligence"],
  excerpt: "Key terms, the cap-table math and the diligence questions still open before close.",
};

export interface ActivityGroup {
  group: string;
  items: { title: string; meta: string; time: string; hot?: boolean }[];
}

export const ACTIVITY: ActivityGroup[] = [
  {
    group: "Today",
    items: [
      { title: "Ingested 3 PDFs from Drive", meta: "Drive", time: "2m", hot: true },
      { title: "Linked “OAuth flow” ↔ “Auth service”", meta: "graph", time: "14m" },
      { title: "Reinforced memory “pricing-v3”", meta: "recall", time: "1h" },
    ],
  },
  {
    group: "Yesterday",
    items: [
      { title: "Synced 48 Slack threads", meta: "Slack", time: "18h" },
      { title: "Embedded 12 web clips", meta: "Web", time: "21h" },
    ],
  },
];

export const CURRENT_USER = {
  name: "Evan Vance",
  email: "evan@symbiotes.ai",
  role: "Owner",
  avatar: "https://i.pravatar.cc/120?img=8",
};
