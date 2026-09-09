import { requiredViteGain } from "./env";
import { gatewayOrigin } from "./gateway";

function requiredString(name: string, value: string | undefined): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

function requiredPositiveInt(name: string, value: string | undefined): number {
  const parsed = Number(requiredString(name, value));
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function requiredBool(name: string, value: string | undefined): boolean {
  const raw = requiredString(name, value);
  if (raw === "true") {
    return true;
  }
  if (raw === "false") {
    return false;
  }
  throw new Error(`${name} must be true or false`);
}

export type VoiceClientConfig = {
  wsUrl: string;
  personaIdQuery: string;
  inputEncoding: string;
  inputSampleRate: number;
  outputEncoding: string;
  outputSampleRate: number;
  channelCount: number;
  captureFrameSamples: number;
  echoCancellation: boolean;
  workletName: string;
  readyType: string;
  errorType: string;
  warningType: string;
  agentEventType: string;
  conversationTextType: string;
  userStartedType: string;
  thinkingType: string;
  audioDoneType: string;
  transcriptUserRole: string;
  transcriptAssistantRole: string;
  vuBarCount: number;
  thinkingCueEnabled: boolean;
  thinkingCueUrl: string;
  thinkingCueLoop: boolean;
  thinkingCueIntervalMs: number;
  thinkingCueMaxMs: number;
  thinkingCueLabel: string;
  playbackSpeakGain: number;
  playbackDuckGain: number;
  reconnectingCode: string;
  reconnectedCode: string;
  connectionDropped: string;
};

export function loadVoiceClientConfig(): VoiceClientConfig {
  const path = requiredString(
    "VITE_VOICE_WS_PATH",
    import.meta.env.VITE_VOICE_WS_PATH,
  );
  if (!path.startsWith("/")) {
    throw new Error("VITE_VOICE_WS_PATH must start with /");
  }
  const origin = new URL(gatewayOrigin());
  const ws = new URL(path, origin);
  ws.protocol = origin.protocol === "https:" ? "wss:" : "ws:";

  return {
    wsUrl: ws.toString(),
    personaIdQuery: requiredString(
      "VITE_PERSONA_ID_QUERY",
      import.meta.env.VITE_PERSONA_ID_QUERY,
    ),
    inputEncoding: requiredString(
      "VITE_DEEPGRAM_AUDIO_INPUT_ENCODING",
      import.meta.env.VITE_DEEPGRAM_AUDIO_INPUT_ENCODING,
    ),
    inputSampleRate: requiredPositiveInt(
      "VITE_DEEPGRAM_AUDIO_INPUT_SAMPLE_RATE",
      import.meta.env.VITE_DEEPGRAM_AUDIO_INPUT_SAMPLE_RATE,
    ),
    outputEncoding: requiredString(
      "VITE_DEEPGRAM_AUDIO_OUTPUT_ENCODING",
      import.meta.env.VITE_DEEPGRAM_AUDIO_OUTPUT_ENCODING,
    ),
    outputSampleRate: requiredPositiveInt(
      "VITE_DEEPGRAM_AUDIO_OUTPUT_SAMPLE_RATE",
      import.meta.env.VITE_DEEPGRAM_AUDIO_OUTPUT_SAMPLE_RATE,
    ),
    channelCount: requiredPositiveInt(
      "VITE_VOICE_CHANNEL_COUNT",
      import.meta.env.VITE_VOICE_CHANNEL_COUNT,
    ),
    captureFrameSamples: requiredPositiveInt(
      "VITE_VOICE_CAPTURE_FRAME_SAMPLES",
      import.meta.env.VITE_VOICE_CAPTURE_FRAME_SAMPLES,
    ),
    echoCancellation: requiredBool(
      "VITE_VOICE_ECHO_CANCELLATION",
      import.meta.env.VITE_VOICE_ECHO_CANCELLATION,
    ),
    workletName: requiredString(
      "VITE_VOICE_WORKLET_NAME",
      import.meta.env.VITE_VOICE_WORKLET_NAME,
    ),
    readyType: requiredString(
      "VITE_VOICE_CLIENT_READY_TYPE",
      import.meta.env.VITE_VOICE_CLIENT_READY_TYPE,
    ),
    errorType: requiredString(
      "VITE_VOICE_CLIENT_ERROR_TYPE",
      import.meta.env.VITE_VOICE_CLIENT_ERROR_TYPE,
    ),
    warningType: requiredString(
      "VITE_VOICE_CLIENT_WARNING_TYPE",
      import.meta.env.VITE_VOICE_CLIENT_WARNING_TYPE,
    ),
    agentEventType: requiredString(
      "VITE_VOICE_CLIENT_AGENT_EVENT_TYPE",
      import.meta.env.VITE_VOICE_CLIENT_AGENT_EVENT_TYPE,
    ),
    conversationTextType: requiredString(
      "VITE_DEEPGRAM_MSG_CONVERSATION_TEXT",
      import.meta.env.VITE_DEEPGRAM_MSG_CONVERSATION_TEXT,
    ),
    userStartedType: requiredString(
      "VITE_DEEPGRAM_MSG_USER_STARTED",
      import.meta.env.VITE_DEEPGRAM_MSG_USER_STARTED,
    ),
    thinkingType: requiredString(
      "VITE_DEEPGRAM_MSG_AGENT_THINKING",
      import.meta.env.VITE_DEEPGRAM_MSG_AGENT_THINKING,
    ),
    audioDoneType: requiredString(
      "VITE_DEEPGRAM_MSG_AGENT_AUDIO_DONE",
      import.meta.env.VITE_DEEPGRAM_MSG_AGENT_AUDIO_DONE,
    ),
    transcriptUserRole: requiredString(
      "VITE_VOICE_TRANSCRIPT_USER_ROLE",
      import.meta.env.VITE_VOICE_TRANSCRIPT_USER_ROLE,
    ),
    transcriptAssistantRole: requiredString(
      "VITE_VOICE_TRANSCRIPT_ASSISTANT_ROLE",
      import.meta.env.VITE_VOICE_TRANSCRIPT_ASSISTANT_ROLE,
    ),
    vuBarCount: requiredPositiveInt(
      "VITE_VOICE_VU_BAR_COUNT",
      import.meta.env.VITE_VOICE_VU_BAR_COUNT,
    ),
    thinkingCueEnabled: requiredBool(
      "VITE_VOICE_THINKING_CUE_ENABLED",
      import.meta.env.VITE_VOICE_THINKING_CUE_ENABLED,
    ),
    thinkingCueUrl: requiredString(
      "VITE_VOICE_THINKING_CUE_URL",
      import.meta.env.VITE_VOICE_THINKING_CUE_URL,
    ),
    thinkingCueLoop: requiredBool(
      "VITE_VOICE_THINKING_CUE_LOOP",
      import.meta.env.VITE_VOICE_THINKING_CUE_LOOP,
    ),
    thinkingCueIntervalMs: requiredPositiveInt(
      "VITE_VOICE_THINKING_CUE_INTERVAL_MS",
      import.meta.env.VITE_VOICE_THINKING_CUE_INTERVAL_MS,
    ),
    thinkingCueMaxMs: requiredPositiveInt(
      "VITE_VOICE_THINKING_CUE_MAX_MS",
      import.meta.env.VITE_VOICE_THINKING_CUE_MAX_MS,
    ),
    thinkingCueLabel: requiredString(
      "VITE_VOICE_THINKING_CUE_LABEL",
      import.meta.env.VITE_VOICE_THINKING_CUE_LABEL,
    ),
    playbackSpeakGain: requiredViteGain("VITE_VOICE_PLAYBACK_SPEAK_GAIN"),
    playbackDuckGain: requiredViteGain("VITE_VOICE_PLAYBACK_DUCK_GAIN"),
    reconnectingCode: requiredString(
      "VITE_FAILURE_CODE_RECONNECTING",
      import.meta.env.VITE_FAILURE_CODE_RECONNECTING,
    ),
    reconnectedCode: requiredString(
      "VITE_FAILURE_CODE_RECONNECTED",
      import.meta.env.VITE_FAILURE_CODE_RECONNECTED,
    ),
    connectionDropped: requiredString(
      "VITE_VOICE_CONNECTION_DROPPED",
      import.meta.env.VITE_VOICE_CONNECTION_DROPPED,
    ),
  };
}

export function voiceSocketUrl(
  config: VoiceClientConfig,
  personaId: string,
): string {
  const url = new URL(config.wsUrl);
  url.searchParams.set(config.personaIdQuery, personaId);
  return url.toString();
}
