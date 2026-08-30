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
  };
}
