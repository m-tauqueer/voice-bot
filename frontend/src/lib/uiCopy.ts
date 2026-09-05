import { requiredVite, requiredViteBool, requiredViteInt } from "./env";
import { labelFor, parseLabeledList, type Labeled } from "./pairs";

export type UiCopy = {
  ranges: Labeled[];
  defaultRange: string;
  defaultBucket: string;
  budgetFirstWordMs: number;
  channelFilters: Labeled[];
  filterAnyId: string;
  stageLabels: Labeled[];
  brainModeLabels: Labeled[];
  kpi: {
    calls: string;
    turns: string;
    firstWord: string;
    errorRate: string;
    callsIcon: string;
    turnsIcon: string;
    firstWordIcon: string;
    errorRateIcon: string;
  };
  graphTurns: string;
  graphSessions: string;
  emptyRange: string;
  emptyList: string;
  emptyTranscript: string;
  emptyMemory: string;
  fetchError: string;
  retry: string;
  loadMore: string;
  sessionEnded: string;
  sessionOpen: string;
  subscriptionNote: string;
  subscriptionNone: string;
  msUnit: string;
  secondUnit: string;
  percentUnit: string;
  audioAbsent: string;
  audioUser: string;
  audioBot: string;
  audioUserDirection: string;
  audioBotDirection: string;
  reasonsLabel: string;
  actionLabel: string;
  latencyLabel: string;
  memoryRefsLabel: string;
  correlationLabel: string;
  backLabel: string;
  memoryTitle: string;
  memoryUnavailable: string;
  memoryEnabled: boolean;
  peopleTitle: string;
  waitlistTitle: string;
  waitlistBody: string;
  accessDeniedTitle: string;
  accessDeniedBody: string;
  accessRevokedTitle: string;
  accessRevokedBody: string;
  waitlistQueueTitle: string;
  waitlistApproveLabel: string;
  waitlistDenyLabel: string;
  waitlistRevokeLabel: string;
  waitlistEmptyQueue: string;
  waitlistSelectedNone: string;
  conversationsTitle: string;
  overviewActivity: string;
  overviewLatency: string;
  overviewBudget: string;
  recentTitle: string;
  quotaTitle: string;
  quotaHelp: string;
  quotaTurnsLabel: string;
  quotaMinutesLabel: string;
  quotaTimezoneLabel: string;
  quotaWarnLabel: string;
  quotaSaveLabel: string;
  quotaSaved: string;
};

let cached: UiCopy | null = null;

export function resetUiCopy(): void {
  cached = null;
}

export function loadUiCopy(): UiCopy {
  if (cached) {
    return cached;
  }
  const ranges = parseLabeledList(
    requiredVite("VITE_INSIGHTS_RANGE_LABELS"),
    "VITE_INSIGHTS_RANGE_LABELS",
  );
  const defaultRange = requiredVite("VITE_INSIGHTS_DEFAULT_RANGE");
  if (!ranges.some((item) => item.id === defaultRange)) {
    throw new Error("VITE_INSIGHTS_DEFAULT_RANGE must be listed in VITE_INSIGHTS_RANGE_LABELS");
  }
  cached = {
    ranges,
    defaultRange,
    defaultBucket: requiredVite("VITE_INSIGHTS_DEFAULT_BUCKET"),
    budgetFirstWordMs: requiredViteInt("VITE_LATENCY_BUDGET_FIRST_WORD_MS"),
    channelFilters: parseLabeledList(
      requiredVite("VITE_CHANNEL_FILTERS"),
      "VITE_CHANNEL_FILTERS",
    ),
    filterAnyId: requiredVite("VITE_FILTER_ANY"),
    stageLabels: parseLabeledList(
      requiredVite("VITE_STAGE_LABELS"),
      "VITE_STAGE_LABELS",
    ),
    brainModeLabels: parseLabeledList(
      requiredVite("VITE_BRAIN_MODE_LABELS"),
      "VITE_BRAIN_MODE_LABELS",
    ),
    kpi: {
      calls: requiredVite("VITE_KPI_CALLS_LABEL"),
      turns: requiredVite("VITE_KPI_TURNS_LABEL"),
      firstWord: requiredVite("VITE_KPI_FIRST_WORD_LABEL"),
      errorRate: requiredVite("VITE_KPI_ERROR_RATE_LABEL"),
      callsIcon: requiredVite("VITE_KPI_CALLS_ICON"),
      turnsIcon: requiredVite("VITE_KPI_TURNS_ICON"),
      firstWordIcon: requiredVite("VITE_KPI_FIRST_WORD_ICON"),
      errorRateIcon: requiredVite("VITE_KPI_ERROR_RATE_ICON"),
    },
    graphTurns: requiredVite("VITE_GRAPH_TURNS_LABEL"),
    graphSessions: requiredVite("VITE_GRAPH_SESSIONS_LABEL"),
    emptyRange: requiredVite("VITE_EMPTY_RANGE"),
    emptyList: requiredVite("VITE_EMPTY_LIST"),
    emptyTranscript: requiredVite("VITE_EMPTY_TRANSCRIPT"),
    emptyMemory: requiredVite("VITE_EMPTY_MEMORY"),
    fetchError: requiredVite("VITE_FETCH_ERROR"),
    retry: requiredVite("VITE_RETRY_LABEL"),
    loadMore: requiredVite("VITE_LOAD_MORE_LABEL"),
    sessionEnded: requiredVite("VITE_SESSION_ENDED_LABEL"),
    sessionOpen: requiredVite("VITE_SESSION_OPEN_LABEL"),
    subscriptionNote: requiredVite("VITE_SUBSCRIPTION_NOTE"),
    subscriptionNone: requiredVite("VITE_SUBSCRIPTION_NONE"),
    msUnit: requiredVite("VITE_MS_UNIT"),
    secondUnit: requiredVite("VITE_SECOND_UNIT"),
    percentUnit: requiredVite("VITE_PERCENT_UNIT"),
    audioAbsent: requiredVite("VITE_AUDIO_ABSENT"),
    audioUser: requiredVite("VITE_AUDIO_USER_LABEL"),
    audioBot: requiredVite("VITE_AUDIO_BOT_LABEL"),
    audioUserDirection: requiredVite("VITE_AUDIO_DIRECTION_USER"),
    audioBotDirection: requiredVite("VITE_AUDIO_DIRECTION_BOT"),
    reasonsLabel: requiredVite("VITE_REASONS_LABEL"),
    actionLabel: requiredVite("VITE_ACTION_LABEL"),
    latencyLabel: requiredVite("VITE_LATENCY_LABEL"),
    memoryRefsLabel: requiredVite("VITE_MEMORY_REFS_LABEL"),
    correlationLabel: requiredVite("VITE_CORRELATION_LABEL"),
    backLabel: requiredVite("VITE_BACK_LABEL"),
    memoryTitle: requiredVite("VITE_MEMORY_PANEL_TITLE"),
    memoryUnavailable: requiredVite("VITE_MEMORY_PANEL_UNAVAILABLE"),
    memoryEnabled: requiredViteBool("VITE_MEMORY_PANEL_ENABLED"),
    peopleTitle: requiredVite("VITE_PEOPLE_TITLE"),
    waitlistTitle: requiredVite("VITE_WAITLIST_TITLE"),
    waitlistBody: requiredVite("VITE_WAITLIST_BODY"),
    accessDeniedTitle: requiredVite("VITE_ACCESS_DENIED_TITLE"),
    accessDeniedBody: requiredVite("VITE_ACCESS_DENIED_BODY"),
    accessRevokedTitle: requiredVite("VITE_ACCESS_REVOKED_TITLE"),
    accessRevokedBody: requiredVite("VITE_ACCESS_REVOKED_BODY"),
    waitlistQueueTitle: requiredVite("VITE_WAITLIST_QUEUE_TITLE"),
    waitlistApproveLabel: requiredVite("VITE_WAITLIST_APPROVE_LABEL"),
    waitlistDenyLabel: requiredVite("VITE_WAITLIST_DENY_LABEL"),
    waitlistRevokeLabel: requiredVite("VITE_WAITLIST_REVOKE_LABEL"),
    waitlistEmptyQueue: requiredVite("VITE_WAITLIST_EMPTY_QUEUE"),
    waitlistSelectedNone: requiredVite("VITE_WAITLIST_SELECTED_NONE"),
    conversationsTitle: requiredVite("VITE_CONVERSATIONS_TITLE"),
    overviewActivity: requiredVite("VITE_OVERVIEW_ACTIVITY_TITLE"),
    overviewLatency: requiredVite("VITE_OVERVIEW_LATENCY_TITLE"),
    overviewBudget: requiredVite("VITE_OVERVIEW_BUDGET_LABEL"),
    recentTitle: requiredVite("VITE_RECENT_TITLE"),
    quotaTitle: requiredVite("VITE_QUOTA_TITLE"),
    quotaHelp: requiredVite("VITE_QUOTA_HELP"),
    quotaTurnsLabel: requiredVite("VITE_QUOTA_TURNS_LABEL"),
    quotaMinutesLabel: requiredVite("VITE_QUOTA_MINUTES_LABEL"),
    quotaTimezoneLabel: requiredVite("VITE_QUOTA_TIMEZONE_LABEL"),
    quotaWarnLabel: requiredVite("VITE_QUOTA_WARN_LABEL"),
    quotaSaveLabel: requiredVite("VITE_QUOTA_SAVE_LABEL"),
    quotaSaved: requiredVite("VITE_QUOTA_SAVED"),
  };
  return cached;
}

export function rangeLabel(id: string): string {
  return labelFor(loadUiCopy().ranges, id);
}

export function stageLabel(id: string): string {
  return labelFor(loadUiCopy().stageLabels, id);
}

export function brainModeLabel(id: string): string {
  return labelFor(loadUiCopy().brainModeLabels, id);
}

export function channelLabel(id: string): string {
  return labelFor(loadUiCopy().channelFilters, id);
}
