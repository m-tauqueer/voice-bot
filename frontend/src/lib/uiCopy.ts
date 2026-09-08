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
  overviewHealth: string;
  overviewOps: string;
  overviewOpsEmpty: string;
  recentTitle: string;
  quotaTitle: string;
  quotaHelp: string;
  quotaTurnsLabel: string;
  quotaMinutesLabel: string;
  quotaTimezoneLabel: string;
  quotaWarnLabel: string;
  quotaSaveLabel: string;
  quotaSaved: string;
  privacyTitle: string;
  privacyBody: string;
  termsTitle: string;
  termsBody: string;
  statusTitle: string;
  statusUpdated: string;
  statusComponents: string;
  statusIncidents: string;
  statusEmpty: string;
  statusLink: string;
  consentTitle: string;
  consentBody: string;
  consentPrivacyLabel: string;
  consentTermsLabel: string;
  consentAcceptLabel: string;
  cookieNoticeBody: string;
  cookieNoticeAccept: string;
  dataTitle: string;
  dataHelp: string;
  dataExportTitle: string;
  dataExportBody: string;
  dataExportLabel: string;
  dataExportDone: string;
  dataDeleteTitle: string;
  dataDeleteBody: string;
  dataDeleteHint: string;
  dataDeletePending: string;
  dataConfirmationLabel: string;
  dataDeleteNowLabel: string;
  dataRequestLabel: string;
  dataCancelRequestLabel: string;
  dataOwnerProtected: string;
  deletionsTitle: string;
  deletionsQueueTitle: string;
  deletionsHelp: string;
  deletionsCompleteLabel: string;
  deletionsCancelLabel: string;
  deletionsEmptyQueue: string;
  deletionsSelectedNone: string;
  personaCatalogHelp: string;
  personaListTitle: string;
  personaListEmpty: string;
  personaAddLabel: string;
  personaCreateTitle: string;
  personaCreateHelp: string;
  personaCreateLabel: string;
  personaCreatingLabel: string;
  personaLinkTitle: string;
  personaLinkHelp: string;
  personaLinkLabel: string;
  personaLinkingLabel: string;
  personaCreateForbidden: string;
  personaSaveLabel: string;
  personaSavingLabel: string;
  personaSaved: string;
  personaCreated: string;
  personaLinked: string;
  personaPublishLabel: string;
  personaUnpublishLabel: string;
  personaPublished: string;
  personaUnpublished: string;
  personaPublishedBadge: string;
  personaDraftBadge: string;
  personaUnpublishConfirmTitle: string;
  personaUnpublishConfirmBody: string;
  personaUnpublishConfirmLabel: string;
  personaConfirmCancelLabel: string;
  personaDestroyTitle: string;
  personaDestroyBody: string;
  personaDestroyHint: string;
  personaDestroyConfirmLabel: string;
  personaDestroyLabel: string;
  personaDestroyingLabel: string;
  personaDestroyed: string;
  requestFailed: string;
  callPhaseIdle: string;
  callPhaseConnecting: string;
  callPhaseListening: string;
  callPhaseThinking: string;
  callPhaseSpeaking: string;
  callPhaseReconnecting: string;
  callPhaseError: string;
  callStartLabel: string;
  callStartingLabel: string;
  callEndLabel: string;
  callMicLabel: string;
  callSessionSavedBadge: string;
  callTranscriptListening: string;
  callTranscriptIdle: string;
  chatNewConversationLabel: string;
  chatThinkingLabel: string;
  chatMessageLabel: string;
  chatSendLabel: string;
  chatSendingLabel: string;
  personaHandleLabel: string;
  personaNameLabel: string;
  personaDescriptionLabel: string;
  personaEngramIdLabel: string;
  personaTtsLabel: string;
  personaTtsHelp: string;
  personaFishLabel: string;
  personaFishHelp: string;
  personaVoiceJsonLabel: string;
  personaVoiceInvalid: string;
  personaTeachTitle: string;
  personaTeachLabel: string;
  personaTeachButton: string;
  personaTeachingLabel: string;
  personaTaught: string;
  personaQuestionsTitle: string;
  personaQuestionsCoverage: string;
  personaQuestionsEmpty: string;
  personaQuestionsRefresh: string;
  personaQuestionsRefreshed: string;
  personaQuestionsKey: string;
  personaQuestionsAnswer: string;
  personaQuestionsSave: string;
  personaQuestionsSaved: string;
  personaQuestionsUseKey: string;
  personaIngestTitle: string;
  personaIngestButton: string;
  personaIngestingLabel: string;
  personaIngested: string;
  personaSubscribeTitle: string;
  personaSubscribeUser: string;
  personaSubscribeButton: string;
  personaSubscribed: string;
  personaSelectFirst: string;
  personaPickerTitle: string;
  personaPickerEmpty: string;
  personaPickerHelp: string;
  personaPickerChatHelp: string;
  personaPickerHistoryHelp: string;
  personaNeedPick: string;
  personaChatReady: string;
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
    overviewHealth: requiredVite("VITE_OVERVIEW_HEALTH_TITLE"),
    overviewOps: requiredVite("VITE_OVERVIEW_OPS_TITLE"),
    overviewOpsEmpty: requiredVite("VITE_OVERVIEW_OPS_EMPTY"),
    recentTitle: requiredVite("VITE_RECENT_TITLE"),
    quotaTitle: requiredVite("VITE_QUOTA_TITLE"),
    quotaHelp: requiredVite("VITE_QUOTA_HELP"),
    quotaTurnsLabel: requiredVite("VITE_QUOTA_TURNS_LABEL"),
    quotaMinutesLabel: requiredVite("VITE_QUOTA_MINUTES_LABEL"),
    quotaTimezoneLabel: requiredVite("VITE_QUOTA_TIMEZONE_LABEL"),
    quotaWarnLabel: requiredVite("VITE_QUOTA_WARN_LABEL"),
    quotaSaveLabel: requiredVite("VITE_QUOTA_SAVE_LABEL"),
    quotaSaved: requiredVite("VITE_QUOTA_SAVED"),
    privacyTitle: requiredVite("VITE_PRIVACY_TITLE"),
    privacyBody: requiredVite("VITE_PRIVACY_BODY"),
    termsTitle: requiredVite("VITE_TERMS_TITLE"),
    termsBody: requiredVite("VITE_TERMS_BODY"),
    statusTitle: requiredVite("VITE_STATUS_TITLE"),
    statusUpdated: requiredVite("VITE_STATUS_UPDATED"),
    statusComponents: requiredVite("VITE_STATUS_COMPONENTS"),
    statusIncidents: requiredVite("VITE_STATUS_INCIDENTS"),
    statusEmpty: requiredVite("VITE_STATUS_EMPTY"),
    statusLink: requiredVite("VITE_STATUS_LINK"),
    consentTitle: requiredVite("VITE_CONSENT_TITLE"),
    consentBody: requiredVite("VITE_CONSENT_BODY"),
    consentPrivacyLabel: requiredVite("VITE_CONSENT_PRIVACY_LABEL"),
    consentTermsLabel: requiredVite("VITE_CONSENT_TERMS_LABEL"),
    consentAcceptLabel: requiredVite("VITE_CONSENT_ACCEPT_LABEL"),
    cookieNoticeBody: requiredVite("VITE_COOKIE_NOTICE_BODY"),
    cookieNoticeAccept: requiredVite("VITE_COOKIE_NOTICE_ACCEPT"),
    dataTitle: requiredVite("VITE_DATA_TITLE"),
    dataHelp: requiredVite("VITE_DATA_HELP"),
    dataExportTitle: requiredVite("VITE_DATA_EXPORT_TITLE"),
    dataExportBody: requiredVite("VITE_DATA_EXPORT_BODY"),
    dataExportLabel: requiredVite("VITE_DATA_EXPORT_LABEL"),
    dataExportDone: requiredVite("VITE_DATA_EXPORT_DONE"),
    dataDeleteTitle: requiredVite("VITE_DATA_DELETE_TITLE"),
    dataDeleteBody: requiredVite("VITE_DATA_DELETE_BODY"),
    dataDeleteHint: requiredVite("VITE_DATA_DELETE_HINT"),
    dataDeletePending: requiredVite("VITE_DATA_DELETE_PENDING"),
    dataConfirmationLabel: requiredVite("VITE_DATA_CONFIRMATION_LABEL"),
    dataDeleteNowLabel: requiredVite("VITE_DATA_DELETE_NOW_LABEL"),
    dataRequestLabel: requiredVite("VITE_DATA_REQUEST_LABEL"),
    dataCancelRequestLabel: requiredVite("VITE_DATA_CANCEL_REQUEST_LABEL"),
    dataOwnerProtected: requiredVite("VITE_DATA_OWNER_PROTECTED"),
    deletionsTitle: requiredVite("VITE_DELETIONS_TITLE"),
    deletionsQueueTitle: requiredVite("VITE_DELETIONS_QUEUE_TITLE"),
    deletionsHelp: requiredVite("VITE_DELETIONS_HELP"),
    deletionsCompleteLabel: requiredVite("VITE_DELETIONS_COMPLETE_LABEL"),
    deletionsCancelLabel: requiredVite("VITE_DELETIONS_CANCEL_LABEL"),
    deletionsEmptyQueue: requiredVite("VITE_DELETIONS_EMPTY_QUEUE"),
    deletionsSelectedNone: requiredVite("VITE_DELETIONS_SELECTED_NONE"),
    personaCatalogHelp: requiredVite("VITE_PERSONA_CATALOG_HELP"),
    personaListTitle: requiredVite("VITE_PERSONA_LIST_TITLE"),
    personaListEmpty: requiredVite("VITE_PERSONA_LIST_EMPTY"),
    personaAddLabel: requiredVite("VITE_PERSONA_ADD_LABEL"),
    personaCreateTitle: requiredVite("VITE_PERSONA_CREATE_TITLE"),
    personaCreateHelp: requiredVite("VITE_PERSONA_CREATE_HELP"),
    personaCreateLabel: requiredVite("VITE_PERSONA_CREATE_LABEL"),
    personaCreatingLabel: requiredVite("VITE_PERSONA_CREATING_LABEL"),
    personaLinkTitle: requiredVite("VITE_PERSONA_LINK_TITLE"),
    personaLinkHelp: requiredVite("VITE_PERSONA_LINK_HELP"),
    personaLinkLabel: requiredVite("VITE_PERSONA_LINK_LABEL"),
    personaLinkingLabel: requiredVite("VITE_PERSONA_LINKING_LABEL"),
    personaCreateForbidden: requiredVite("VITE_PERSONA_CREATE_FORBIDDEN"),
    personaSaveLabel: requiredVite("VITE_PERSONA_SAVE_LABEL"),
    personaSavingLabel: requiredVite("VITE_PERSONA_SAVING_LABEL"),
    personaSaved: requiredVite("VITE_PERSONA_SAVED"),
    personaCreated: requiredVite("VITE_PERSONA_CREATED"),
    personaLinked: requiredVite("VITE_PERSONA_LINKED"),
    personaPublishLabel: requiredVite("VITE_PERSONA_PUBLISH_LABEL"),
    personaUnpublishLabel: requiredVite("VITE_PERSONA_UNPUBLISH_LABEL"),
    personaPublished: requiredVite("VITE_PERSONA_PUBLISHED"),
    personaUnpublished: requiredVite("VITE_PERSONA_UNPUBLISHED"),
    personaPublishedBadge: requiredVite("VITE_PERSONA_PUBLISHED_BADGE"),
    personaDraftBadge: requiredVite("VITE_PERSONA_DRAFT_BADGE"),
    personaUnpublishConfirmTitle: requiredVite(
      "VITE_PERSONA_UNPUBLISH_CONFIRM_TITLE",
    ),
    personaUnpublishConfirmBody: requiredVite(
      "VITE_PERSONA_UNPUBLISH_CONFIRM_BODY",
    ),
    personaUnpublishConfirmLabel: requiredVite(
      "VITE_PERSONA_UNPUBLISH_CONFIRM_LABEL",
    ),
    personaConfirmCancelLabel: requiredVite("VITE_PERSONA_CONFIRM_CANCEL_LABEL"),
    personaDestroyTitle: requiredVite("VITE_PERSONA_DESTROY_TITLE"),
    personaDestroyBody: requiredVite("VITE_PERSONA_DESTROY_BODY"),
    personaDestroyHint: requiredVite("VITE_PERSONA_DESTROY_HINT"),
    personaDestroyConfirmLabel: requiredVite(
      "VITE_PERSONA_DESTROY_CONFIRM_LABEL",
    ),
    personaDestroyLabel: requiredVite("VITE_PERSONA_DESTROY_LABEL"),
    personaDestroyingLabel: requiredVite("VITE_PERSONA_DESTROYING_LABEL"),
    personaDestroyed: requiredVite("VITE_PERSONA_DESTROYED"),
    requestFailed: requiredVite("VITE_REQUEST_FAILED"),
    callPhaseIdle: requiredVite("VITE_CALL_PHASE_IDLE"),
    callPhaseConnecting: requiredVite("VITE_CALL_PHASE_CONNECTING"),
    callPhaseListening: requiredVite("VITE_CALL_PHASE_LISTENING"),
    callPhaseThinking: requiredVite("VITE_CALL_PHASE_THINKING"),
    callPhaseSpeaking: requiredVite("VITE_CALL_PHASE_SPEAKING"),
    callPhaseReconnecting: requiredVite("VITE_CALL_PHASE_RECONNECTING"),
    callPhaseError: requiredVite("VITE_CALL_PHASE_ERROR"),
    callStartLabel: requiredVite("VITE_CALL_START_LABEL"),
    callStartingLabel: requiredVite("VITE_CALL_STARTING_LABEL"),
    callEndLabel: requiredVite("VITE_CALL_END_LABEL"),
    callMicLabel: requiredVite("VITE_CALL_MIC_LABEL"),
    callSessionSavedBadge: requiredVite("VITE_CALL_SESSION_SAVED_BADGE"),
    callTranscriptListening: requiredVite("VITE_CALL_TRANSCRIPT_LISTENING"),
    callTranscriptIdle: requiredVite("VITE_CALL_TRANSCRIPT_IDLE"),
    chatNewConversationLabel: requiredVite("VITE_CHAT_NEW_CONVERSATION_LABEL"),
    chatThinkingLabel: requiredVite("VITE_CHAT_THINKING_LABEL"),
    chatMessageLabel: requiredVite("VITE_CHAT_MESSAGE_LABEL"),
    chatSendLabel: requiredVite("VITE_CHAT_SEND_LABEL"),
    chatSendingLabel: requiredVite("VITE_CHAT_SENDING_LABEL"),
    personaHandleLabel: requiredVite("VITE_PERSONA_HANDLE_LABEL"),
    personaNameLabel: requiredVite("VITE_PERSONA_NAME_LABEL"),
    personaDescriptionLabel: requiredVite("VITE_PERSONA_DESCRIPTION_LABEL"),
    personaEngramIdLabel: requiredVite("VITE_PERSONA_ENGRAM_ID_LABEL"),
    personaTtsLabel: requiredVite("VITE_PERSONA_TTS_LABEL"),
    personaTtsHelp: requiredVite("VITE_PERSONA_TTS_HELP"),
    personaFishLabel: requiredVite("VITE_PERSONA_FISH_LABEL"),
    personaFishHelp: requiredVite("VITE_PERSONA_FISH_HELP"),
    personaVoiceJsonLabel: requiredVite("VITE_PERSONA_VOICE_JSON_LABEL"),
    personaVoiceInvalid: requiredVite("VITE_PERSONA_VOICE_INVALID"),
    personaTeachTitle: requiredVite("VITE_PERSONA_TEACH_TITLE"),
    personaTeachLabel: requiredVite("VITE_PERSONA_TEACH_LABEL"),
    personaTeachButton: requiredVite("VITE_PERSONA_TEACH_BUTTON"),
    personaTeachingLabel: requiredVite("VITE_PERSONA_TEACHING_LABEL"),
    personaTaught: requiredVite("VITE_PERSONA_TAUGHT"),
    personaQuestionsTitle: requiredVite("VITE_PERSONA_QUESTIONS_TITLE"),
    personaQuestionsCoverage: requiredVite("VITE_PERSONA_QUESTIONS_COVERAGE"),
    personaQuestionsEmpty: requiredVite("VITE_PERSONA_QUESTIONS_EMPTY"),
    personaQuestionsRefresh: requiredVite("VITE_PERSONA_QUESTIONS_REFRESH"),
    personaQuestionsRefreshed: requiredVite("VITE_PERSONA_QUESTIONS_REFRESHED"),
    personaQuestionsKey: requiredVite("VITE_PERSONA_QUESTIONS_KEY"),
    personaQuestionsAnswer: requiredVite("VITE_PERSONA_QUESTIONS_ANSWER"),
    personaQuestionsSave: requiredVite("VITE_PERSONA_QUESTIONS_SAVE"),
    personaQuestionsSaved: requiredVite("VITE_PERSONA_QUESTIONS_SAVED"),
    personaQuestionsUseKey: requiredVite("VITE_PERSONA_QUESTIONS_USE_KEY"),
    personaIngestTitle: requiredVite("VITE_PERSONA_INGEST_TITLE"),
    personaIngestButton: requiredVite("VITE_PERSONA_INGEST_BUTTON"),
    personaIngestingLabel: requiredVite("VITE_PERSONA_INGESTING_LABEL"),
    personaIngested: requiredVite("VITE_PERSONA_INGESTED"),
    personaSubscribeTitle: requiredVite("VITE_PERSONA_SUBSCRIBE_TITLE"),
    personaSubscribeUser: requiredVite("VITE_PERSONA_SUBSCRIBE_USER"),
    personaSubscribeButton: requiredVite("VITE_PERSONA_SUBSCRIBE_BUTTON"),
    personaSubscribed: requiredVite("VITE_PERSONA_SUBSCRIBED"),
    personaSelectFirst: requiredVite("VITE_PERSONA_SELECT_FIRST"),
    personaPickerTitle: requiredVite("VITE_PERSONA_PICKER_TITLE"),
    personaPickerEmpty: requiredVite("VITE_PERSONA_PICKER_EMPTY"),
    personaPickerHelp: requiredVite("VITE_PERSONA_PICKER_HELP"),
    personaPickerChatHelp: requiredVite("VITE_PERSONA_PICKER_CHAT_HELP"),
    personaPickerHistoryHelp: requiredVite("VITE_PERSONA_PICKER_HISTORY_HELP"),
    personaNeedPick: requiredVite("VITE_PERSONA_NEED_PICK"),
    personaChatReady: requiredVite("VITE_PERSONA_CHAT_READY"),
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
