/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GATEWAY_URL: string;
  readonly VITE_CHAT_SESSION_STORAGE_KEY: string;
  readonly VITE_VOICE_WS_PATH: string;
  readonly VITE_DEEPGRAM_AUDIO_INPUT_ENCODING: string;
  readonly VITE_DEEPGRAM_AUDIO_INPUT_SAMPLE_RATE: string;
  readonly VITE_DEEPGRAM_AUDIO_OUTPUT_ENCODING: string;
  readonly VITE_DEEPGRAM_AUDIO_OUTPUT_SAMPLE_RATE: string;
  readonly VITE_VOICE_CHANNEL_COUNT: string;
  readonly VITE_VOICE_CAPTURE_FRAME_SAMPLES: string;
  readonly VITE_VOICE_ECHO_CANCELLATION: string;
  readonly VITE_VOICE_WORKLET_NAME: string;
  readonly VITE_VOICE_CLIENT_READY_TYPE: string;
  readonly VITE_VOICE_CLIENT_ERROR_TYPE: string;
  readonly VITE_VOICE_CLIENT_WARNING_TYPE: string;
  readonly VITE_VOICE_CLIENT_AGENT_EVENT_TYPE: string;
  readonly VITE_DEEPGRAM_MSG_CONVERSATION_TEXT: string;
  readonly VITE_DEEPGRAM_MSG_USER_STARTED: string;
  readonly VITE_DEEPGRAM_MSG_AGENT_THINKING: string;
  readonly VITE_DEEPGRAM_MSG_AGENT_AUDIO_DONE: string;
  readonly VITE_VOICE_TRANSCRIPT_USER_ROLE: string;
  readonly VITE_VOICE_TRANSCRIPT_ASSISTANT_ROLE: string;
  readonly VITE_VOICE_VU_BAR_COUNT: string;
  readonly VITE_VOICE_THINKING_CUE_ENABLED: string;
  readonly VITE_VOICE_THINKING_CUE_URL: string;
  readonly VITE_VOICE_THINKING_CUE_LOOP: string;
  readonly VITE_VOICE_THINKING_CUE_INTERVAL_MS: string;
  readonly VITE_VOICE_THINKING_CUE_MAX_MS: string;
  readonly VITE_VOICE_THINKING_CUE_LABEL: string;
  readonly VITE_FAILURE_CODE_RECONNECTING: string;
  readonly VITE_FAILURE_CODE_RECONNECTED: string;
  readonly VITE_VOICE_CONNECTION_DROPPED: string;
  readonly VITE_CHAT_SILENCE_STATUS: string;
  readonly VITE_TURN_SPEAKER_USER: string;
  readonly VITE_TURN_SPEAKER_PERSONA: string;
  readonly VITE_APP_NAME: string;
  readonly VITE_NAV_ROLE_OWNER: string;
  readonly VITE_NAV_ROLE_MEMBER: string;
  readonly VITE_NAV_ITEMS: string;
  readonly VITE_SIGNOUT_LABEL: string;
  readonly VITE_LOADING_LABEL: string;
  readonly VITE_SIGNIN_CONTINUE: string;
  readonly VITE_NOT_OWNER_MESSAGE: string;
  readonly VITE_SIGNIN_TITLE_CHAT: string;
  readonly VITE_SIGNIN_BODY_CHAT: string;
  readonly VITE_SIGNIN_TITLE_VOICE: string;
  readonly VITE_SIGNIN_BODY_VOICE: string;
  readonly VITE_SIGNIN_TITLE_PERSONA: string;
  readonly VITE_SIGNIN_BODY_PERSONA: string;
  readonly VITE_SIGNIN_TITLE_APP: string;
  readonly VITE_SIGNIN_BODY_APP: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
