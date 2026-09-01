import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { z } from "zod";
import { validateInsightsConfig } from "./insights/parse.js";

const requiredPort = z.preprocess(
  (val) => (val === undefined || val === "" ? undefined : val),
  z.coerce.number().int().positive(),
);

const optionalUrl = z.preprocess(
  (val) => (val === undefined || val === "" ? undefined : val),
  z.string().url().optional(),
);

const optionalNonEmpty = z.preprocess(
  (val) => (val === undefined || val === "" ? undefined : val),
  z.string().min(1).optional(),
);

const envFileSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]),
  LOG_LEVEL: z.string().min(1),
  GATEWAY_HOST: z.string().min(1),
  GATEWAY_PORT: requiredPort,
  GATEWAY_PUBLIC_URL: z.string().url(),
  FRONTEND_ORIGIN: z.string().url(),
  CORS_ALLOWED_METHODS: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("GET,HEAD,POST,PUT,PATCH,DELETE"),
  ),
  WORKER_URL: z.string().url(),
  BYO_LLM_PUBLIC_URL: optionalUrl,
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().url(),
  SESSION_SECRET: z.string().min(16),
  INTERNAL_API_SECRET: z.string().min(16),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_CALLBACK_URL: z.string().url(),
  GOOGLE_OIDC_DISCOVERY_URL: z.string().url(),
  GOOGLE_SCOPES: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("openid email profile"),
  ),
  GOOGLE_AUTH_PROMPT: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("select_account"),
  ),
  GOOGLE_REQUIRE_EMAIL_VERIFIED: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.enum(["true", "false"]).default("true"),
  ),
  GOOGLE_ID_TOKEN_ISSUERS: optionalNonEmpty,
  GOOGLE_PKCE_METHOD: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("S256"),
  ),
  SESSION_COOKIE_NAME: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("vb_session"),
  ),
  SESSION_COOKIE_PATH: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("/"),
  ),
  SESSION_COOKIE_SAMESITE: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.enum(["lax", "strict", "none"]).default("lax"),
  ),
  SESSION_TTL_SECONDS: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.coerce.number().int().positive().default(604800),
  ),
  SESSION_COOKIE_SECURE: z.preprocess((val) => {
    if (val === undefined || val === "") return undefined;
    return val;
  }, z.enum(["true", "false"]).optional()),
  SESSION_REDIS_KEY_PREFIX: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("session:"),
  ),
  CHAT_ACTIVITY_REDIS_KEY_PREFIX: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("chat-activity:"),
  ),
  CHAT_ACTIVITY_TTL_SECONDS: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.coerce.number().int().positive().default(86400),
  ),
  SESSION_ID_BYTES: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.coerce.number().int().positive().default(32),
  ),
  OAUTH_REDIS_KEY_PREFIX: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("oauth:"),
  ),
  OAUTH_PENDING_TTL_SECONDS: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.coerce.number().int().positive().default(600),
  ),
  OAUTH_TOKEN_BYTES: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.coerce.number().int().positive().default(32),
  ),
  OIDC_DISCOVERY_TTL_SECONDS: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.coerce.number().int().positive().default(3600),
  ),
  OIDC_CLOCK_TOLERANCE_SECONDS: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.coerce.number().int().nonnegative().default(60),
  ),
  OIDC_HTTP_TIMEOUT_MS: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.coerce.number().int().positive().default(10000),
  ),
  WORKER_HTTP_TIMEOUT_MS: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.coerce.number().int().positive().default(120000),
  ),
  INTERNAL_SECRET_HEADER: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("x-internal-secret"),
  ),
  POST_LOGIN_REDIRECT_URL: optionalUrl,
  OWNER_EMAILS: z.preprocess(
    (val) => (val === undefined ? "" : val),
    z.string(),
  ),
  ADMIN_INGEST_MAX_BYTES: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.coerce.number().int().positive().default(8388608),
  ),
  INSIGHTS_PAGE_SIZE: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.coerce.number().int().positive().default(50),
  ),
  INSIGHTS_MAX_PAGE_SIZE: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.coerce.number().int().positive().default(200),
  ),
  INSIGHTS_RANGES: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("today,7d,30d"),
  ),
  INSIGHTS_DEFAULT_RANGE: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("7d"),
  ),
  INSIGHTS_RANGE_WINDOWS: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("today:calendar,7d:7,30d:30"),
  ),
  INSIGHTS_CALENDAR_WINDOW_SPEC: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("calendar"),
  ),
  INSIGHTS_TIMEZONE: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("UTC"),
  ),
  INSIGHTS_ACTIVITY_BUCKETS: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("hour,day"),
  ),
  INSIGHTS_DEFAULT_BUCKET: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("day"),
  ),
  INSIGHTS_ERROR_REASONS: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("server_error,retryable_read,brain_error"),
  ),
  INSIGHTS_BRAIN_MODE_UNRECORDED: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("unrecorded"),
  ),
  INSIGHTS_BRAIN_MODE_MIXED: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("mixed"),
  ),
  INSIGHTS_FIRST_WORD_COLUMNS: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("brain_ms,reframe_first_token_ms"),
  ),
  INSIGHTS_FIRST_WORD_REQUIRED_COLUMN: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("reframe_first_token_ms"),
  ),
  INSIGHTS_LATENCY_STAGES: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z
      .string()
      .min(1)
      .default("stt_ms,brain_ms,reframe_first_token_ms,tts_first_byte_ms"),
  ),
  LATENCY_BUDGET_FIRST_WORD_MS: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.coerce.number().int().positive().default(4000),
  ),
  INSIGHTS_ERROR_INVALID_RANGE: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("invalid range"),
  ),
  INSIGHTS_ERROR_INVALID_CURSOR: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("invalid cursor"),
  ),
  INSIGHTS_ERROR_INVALID_BUCKET: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("invalid bucket"),
  ),
  INSIGHTS_ERROR_INVALID_CHANNEL: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("invalid channel"),
  ),
  INSIGHTS_ERROR_INVALID_USER: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("invalid user_id"),
  ),
  INSIGHTS_ERROR_INVALID_LIMIT: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("invalid limit"),
  ),
  INSIGHTS_ERROR_NOT_FOUND: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("session not found"),
  ),
  MEMORY_PANEL_ENABLED: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.enum(["true", "false"]).default("true"),
  ),
  MEMORY_PANEL_DISABLED: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("memory panel is off"),
  ),
  MEMORY_PANEL_NO_PERSONA: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("persona not found"),
  ),
  ENGRAM_PERSONA_ID: optionalNonEmpty,
  AZURE_STORAGE_ACCOUNT: optionalNonEmpty,
  AZURE_STORAGE_KEY: optionalNonEmpty,
  AZURE_BLOB_CONTAINER: optionalNonEmpty,
  AZURE_BLOB_ENDPOINT: optionalUrl,
  DEEPGRAM_API_KEY: optionalNonEmpty,
  DEEPGRAM_API_BASE_URL: optionalUrl,
  DEEPGRAM_STT_MODEL: optionalNonEmpty,
  DEEPGRAM_STT_LANGUAGE: optionalNonEmpty,
  DEEPGRAM_TTS_VOICE: optionalNonEmpty,
  DEEPGRAM_AGENT_WSS_URL: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().url().default("wss://agent.deepgram.com/v1/agent/converse"),
  ),
  DEEPGRAM_AGENT_AUTH_HEADER: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("Authorization"),
  ),
  DEEPGRAM_AGENT_AUTH_SCHEME: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("Token"),
  ),
  DEEPGRAM_AUDIO_INPUT_ENCODING: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("linear16"),
  ),
  DEEPGRAM_AUDIO_INPUT_SAMPLE_RATE: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.coerce.number().int().positive().default(16000),
  ),
  DEEPGRAM_AUDIO_OUTPUT_ENCODING: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("linear16"),
  ),
  DEEPGRAM_AUDIO_OUTPUT_SAMPLE_RATE: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.coerce.number().int().positive().default(24000),
  ),
  DEEPGRAM_AUDIO_OUTPUT_CONTAINER: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("none"),
  ),
  DEEPGRAM_LISTEN_PROVIDER_TYPE: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("deepgram"),
  ),
  DEEPGRAM_LISTEN_PROVIDER_VERSION: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("v1"),
  ),
  DEEPGRAM_THINK_PROVIDER_TYPE: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("open_ai"),
  ),
  DEEPGRAM_THINK_MODEL: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("gpt-4o-mini"),
  ),
  DEEPGRAM_THINK_PROMPT: optionalNonEmpty,
  DEEPGRAM_SPEAK_PROVIDER_TYPE: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("deepgram"),
  ),
  DEEPGRAM_SPEAK_PROVIDER_VERSION: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("v1"),
  ),
  DEEPGRAM_AGENT_GREETING: optionalNonEmpty,
  DEEPGRAM_MSG_WELCOME: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("Welcome"),
  ),
  DEEPGRAM_MSG_SETTINGS: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("Settings"),
  ),
  DEEPGRAM_MSG_SETTINGS_APPLIED: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("SettingsApplied"),
  ),
  DEEPGRAM_MSG_ERROR: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("Error"),
  ),
  DEEPGRAM_MSG_WARNING: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("Warning"),
  ),
  DEEPGRAM_MSG_INJECT_USER: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("InjectUserMessage"),
  ),
  DEEPGRAM_MSG_CONVERSATION_TEXT: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("ConversationText"),
  ),
  VOICE_TRANSCRIPT_USER_ROLE: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("user"),
  ),
  DEEPGRAM_MSG_USER_STARTED: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("UserStartedSpeaking"),
  ),
  DEEPGRAM_MSG_AGENT_THINKING: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("AgentThinking"),
  ),
  DEEPGRAM_MSG_AGENT_AUDIO_DONE: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("AgentAudioDone"),
  ),
  DEEPGRAM_MSG_LATENCY_REPORT: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("LatencyReport"),
  ),
  DEEPGRAM_LATENCY_STT_FIELD: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("stt_latency"),
  ),
  DEEPGRAM_LATENCY_TTS_FIELD: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("tts_latency"),
  ),
  VOICE_LATENCY_TO_MS: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.coerce.number().positive().default(1000),
  ),
  DEEPGRAM_MSG_KEEP_ALIVE: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("KeepAlive"),
  ),
  DEEPGRAM_KEEP_ALIVE_INTERVAL_MS: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.coerce.number().int().positive().default(8000),
  ),
  DEEPGRAM_AGENT_HANDSHAKE_TIMEOUT_MS: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.coerce.number().int().positive().default(20000),
  ),
  DEEPGRAM_RECONNECT_ATTEMPTS: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.coerce.number().int().nonnegative().default(1),
  ),
  DEEPGRAM_RECONNECT_BACKOFF_MS: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.coerce.number().int().nonnegative().default(750),
  ),
  DEEPGRAM_RECONNECT_ON_CODES: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z
      .string()
      .min(1)
      .default(
        "INTERNAL_SERVER_ERROR,CLIENT_MESSAGE_TIMEOUT,FAILED_TO_START_LISTENING,ASR_CONNECTION_CLOSED,ASR_DRIVER_TIMEOUT,SERVER_GOING_AWAY",
      ),
  ),
  DEEPGRAM_THINK_FATAL_CODES: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("FAILED_TO_THINK"),
  ),
  REDIS_COMMAND_TIMEOUT_MS: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.coerce.number().int().positive().default(500),
  ),
  VOICE_NOTICE_REDIS_CHANNEL: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("voice-notice"),
  ),
  FAILURE_CODE_ENGRAM: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("engram_unavailable"),
  ),
  FAILURE_CODE_SPEAKING_LLM: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("speaking_llm_failed"),
  ),
  FAILURE_CODE_RECORD: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("record_lost"),
  ),
  FAILURE_CODE_DEEPGRAM: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("deepgram_unavailable"),
  ),
  FAILURE_CODE_BLOB: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("audio_not_stored"),
  ),
  FAILURE_CODE_REDIS: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("call_state_degraded"),
  ),
  FAILURE_CODE_RECONNECTING: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("voice_reconnecting"),
  ),
  FAILURE_CODE_RECONNECTED: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("voice_reconnected"),
  ),
  FAILURE_CODE_DATABASE: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("database_unavailable"),
  ),
  FAILURE_CODE_THINK: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("think_failed"),
  ),
  FAILURE_MESSAGE_ENGRAM: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z
      .string()
      .min(1)
      .default(
        "The persona's memory is unavailable. Nothing was invented in its place.",
      ),
  ),
  FAILURE_MESSAGE_SPEAKING_LLM: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z
      .string()
      .min(1)
      .default(
        "The reply stopped early. You heard only the words that were produced.",
      ),
  ),
  FAILURE_MESSAGE_RECORD: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z
      .string()
      .min(1)
      .default(
        "The reply was delivered but the conversation record could not be saved.",
      ),
  ),
  FAILURE_MESSAGE_DEEPGRAM: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("The voice connection could not be restored."),
  ),
  FAILURE_MESSAGE_BLOB: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z
      .string()
      .min(1)
      .default("Call audio is not being stored. The conversation continues."),
  ),
  FAILURE_MESSAGE_REDIS: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z
      .string()
      .min(1)
      .default(
        "Call state is running without the cache. The conversation continues.",
      ),
  ),
  FAILURE_MESSAGE_RECONNECTING: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("The voice connection dropped. Reconnecting…"),
  ),
  FAILURE_MESSAGE_RECONNECTED: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("Voice connection restored."),
  ),
  FAILURE_MESSAGE_DATABASE: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z
      .string()
      .min(1)
      .default(
        "The conversation record is unavailable. This turn could not start.",
      ),
  ),
  FAILURE_MESSAGE_THINK: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z
      .string()
      .min(1)
      .default("The persona could not answer. The call has ended."),
  ),
  FAILURE_MESSAGE_UNKNOWN: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("Something went wrong."),
  ),
  FAILURE_FATAL_CODES: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z
      .string()
      .min(1)
      .default(
        "engram_unavailable,deepgram_unavailable,think_failed,database_unavailable",
      ),
  ),
  BYO_LLM_CHAT_COMPLETIONS_PATH: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("/v1/chat/completions"),
  ),
  BYO_LLM_APP_USER_HEADER: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("x-app-user-id"),
  ),
  BYO_LLM_ENGRAM_USER_HEADER: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("x-engram-user-id"),
  ),
  BYO_LLM_PERSONA_HEADER: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("x-persona-id"),
  ),
  BYO_LLM_SESSION_HEADER: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("x-session-id"),
  ),
  BYO_LLM_ENDPOINT_EXTRA_HEADERS: z.preprocess((val) => {
    if (val === undefined || val === "") {
      return undefined;
    }
    if (typeof val !== "string") {
      return val;
    }
    try {
      return JSON.parse(val) as unknown;
    } catch {
      return val;
    }
  }, z.record(z.string().min(1), z.string()).optional()),
  VOICE_WS_PATH: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("/ws/voice"),
  ),
  VOICE_REDIS_KEY_PREFIX: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("voice-call:"),
  ),
  VOICE_REDIS_TTL_SECONDS: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.coerce.number().int().positive().default(3600),
  ),
  VOICE_PENDING_LATENCY_MAX: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.coerce.number().int().positive().default(8),
  ),
  VOICE_AUDIO_PERSIST_ENABLED: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.enum(["true", "false"]).default("true"),
  ),
  VOICE_AUDIO_FORMAT: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("wav"),
  ),
  VOICE_AUDIO_CONTENT_TYPE: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("audio/wav"),
  ),
  VOICE_AUDIO_BITS_PER_SAMPLE: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.coerce.number().int().positive().default(16),
  ),
  VOICE_AUDIO_MAX_BYTES: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.coerce.number().int().positive().default(16777216),
  ),
  AZURE_BLOB_KEY_PREFIX: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("voice/"),
  ),
  VOICE_CLIENT_READY_TYPE: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("voice.ready"),
  ),
  VOICE_CLIENT_ERROR_TYPE: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("voice.error"),
  ),
  // No preprocess: undefined takes the default, an explicit empty value means
  // suppress nothing.
  VOICE_SUPPRESSED_WARNING_CODES: z.string().default("SLOW_THINK_REQUEST"),
  VOICE_CLIENT_WARNING_TYPE: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("voice.warning"),
  ),
  VOICE_CLIENT_AGENT_EVENT_TYPE: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("voice.agent"),
  ),
  DEEPGRAM_SPEAK_PATH: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("/v1/speak"),
  ),
  VOICE_CALL_PROBE_FIRST_TEXT: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.string().min(1).default("Hello. What are you working on at the moment?"),
  ),
  VOICE_CALL_PROBE_INTERRUPT_TEXT: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z
      .string()
      .min(1)
      .default("Sorry to cut in. Could you tell me that again more briefly?"),
  ),
  VOICE_CALL_PROBE_INTERRUPT_DELAY_MS: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.coerce.number().int().positive().default(1500),
  ),
  VOICE_CALL_PROBE_SILENCE_WINDOW_MS: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.coerce.number().int().positive().default(1500),
  ),
  VOICE_CALL_PROBE_RESUME_BYTES: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.coerce.number().int().positive().default(16000),
  ),
  VOICE_PROBE_FRAME_MS: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.coerce.number().int().positive().default(20),
  ),
  VOICE_PROBE_SETTLE_MS: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.coerce.number().int().positive().default(5000),
  ),
  VOICE_INJECT_TIMEOUT_MS: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : val),
    z.coerce.number().int().positive().default(180000),
  ),
  VOICE_INJECT_TEXT: optionalNonEmpty,
});

export type GatewayConfig = z.infer<typeof envFileSchema>;

export function repoRootFromHere(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "../..");
}

function loadEnvFile(): void {
  const explicit = process.env.ENV_FILE;
  const candidates = [
    ...(explicit ? [explicit] : []),
    resolve(process.cwd(), ".env"),
    resolve(repoRootFromHere(), ".env"),
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      loadDotenv({ path, override: false });
      return;
    }
  }
}

export function loadGatewayConfig(
  raw: NodeJS.ProcessEnv = process.env,
): GatewayConfig {
  loadEnvFile();
  const parsed = envFileSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid gateway environment: ${msg}`);
  }
  const callback = new URL(parsed.data.GOOGLE_CALLBACK_URL);
  const publicUrl = new URL(parsed.data.GATEWAY_PUBLIC_URL);
  if (callback.origin !== publicUrl.origin) {
    throw new Error(
      "Invalid gateway environment: GOOGLE_CALLBACK_URL origin must match GATEWAY_PUBLIC_URL",
    );
  }
  try {
    validateInsightsConfig(parsed.data);
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : "Invalid insights environment",
    );
  }
  return parsed.data;
}

export function sessionCookieSecure(config: GatewayConfig): boolean {
  if (config.SESSION_COOKIE_SECURE === "true") {
    return true;
  }
  if (config.SESSION_COOKIE_SECURE === "false") {
    return false;
  }
  return config.NODE_ENV === "production";
}

export function googleCallbackPath(config: GatewayConfig): string {
  return new URL(config.GOOGLE_CALLBACK_URL).pathname;
}

export function postLoginRedirectUrl(config: GatewayConfig): string {
  return config.POST_LOGIN_REDIRECT_URL ?? config.FRONTEND_ORIGIN;
}

export function frontendPathRedirect(
  config: GatewayConfig,
  raw: string | undefined,
): string | undefined {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return undefined;
  }
  const resolved = new URL(raw, config.FRONTEND_ORIGIN);
  if (resolved.origin !== new URL(config.FRONTEND_ORIGIN).origin) {
    return undefined;
  }
  return `${resolved.pathname}${resolved.search}`;
}

export function googleIdTokenIssuers(
  config: GatewayConfig,
  discoveryIssuer: string,
): string[] {
  if (config.GOOGLE_ID_TOKEN_ISSUERS) {
    const issuers = config.GOOGLE_ID_TOKEN_ISSUERS.split(/\s+/).filter(
      (value) => value.length > 0,
    );
    if (issuers.length > 0) {
      return issuers;
    }
  }
  return [discoveryIssuer];
}

export function corsAllowedMethods(config: GatewayConfig): string[] {
  return config.CORS_ALLOWED_METHODS.split(/[,\s]+/)
    .map((value) => value.trim().toUpperCase())
    .filter((value) => value.length > 0);
}

export function ownerEmails(config: GatewayConfig): Set<string> {
  return new Set(
    config.OWNER_EMAILS.split(/[,\s]+/)
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.length > 0),
  );
}

export function isOwnerEmail(email: string, config: GatewayConfig): boolean {
  return ownerEmails(config).has(email.trim().toLowerCase());
}

export function voiceCallReady(config: GatewayConfig): string | null {
  if (!config.DEEPGRAM_API_KEY) {
    return "DEEPGRAM_API_KEY is not set";
  }
  if (!config.BYO_LLM_PUBLIC_URL) {
    return "BYO_LLM_PUBLIC_URL is not set";
  }
  if (!config.DEEPGRAM_STT_MODEL) {
    return "DEEPGRAM_STT_MODEL is not set";
  }
  if (!config.DEEPGRAM_STT_LANGUAGE) {
    return "DEEPGRAM_STT_LANGUAGE is not set";
  }
  if (!config.DEEPGRAM_TTS_VOICE) {
    return "DEEPGRAM_TTS_VOICE is not set";
  }
  if (!config.VOICE_WS_PATH.startsWith("/")) {
    return "VOICE_WS_PATH must start with /";
  }
  if (!config.BYO_LLM_CHAT_COMPLETIONS_PATH.startsWith("/")) {
    return "BYO_LLM_CHAT_COMPLETIONS_PATH must start with /";
  }
  return null;
}

export function thinkEndpointUrl(config: GatewayConfig): string {
  const base = config.BYO_LLM_PUBLIC_URL;
  if (!base) {
    throw new Error("BYO_LLM_PUBLIC_URL is not set");
  }
  return new URL(config.BYO_LLM_CHAT_COMPLETIONS_PATH, `${base}/`).toString();
}

export function thinkEndpointHeaders(
  config: GatewayConfig,
  identity: {
    appUserId: string;
    engramUserId: string;
    personaId: string;
    sessionId: string;
  },
): Record<string, string> {
  return {
    ...(config.BYO_LLM_ENDPOINT_EXTRA_HEADERS ?? {}),
    [config.INTERNAL_SECRET_HEADER]: config.INTERNAL_API_SECRET,
    [config.BYO_LLM_APP_USER_HEADER]: identity.appUserId,
    [config.BYO_LLM_ENGRAM_USER_HEADER]: identity.engramUserId,
    [config.BYO_LLM_PERSONA_HEADER]: identity.personaId,
    [config.BYO_LLM_SESSION_HEADER]: identity.sessionId,
  };
}

export function clientVoiceWsUrl(config: GatewayConfig): string {
  const base = new URL(config.GATEWAY_PUBLIC_URL);
  const protocol = base.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${base.host}${config.VOICE_WS_PATH}`;
}

export function voiceTunnelCommand(config: GatewayConfig): string {
  const worker = new URL(config.WORKER_URL);
  const port = worker.port || (worker.protocol === "https:" ? "443" : "80");
  return `ngrok http ${port}`;
}

export function deepgramAuthHeaderValue(config: GatewayConfig): string {
  return `${config.DEEPGRAM_AGENT_AUTH_SCHEME} ${config.DEEPGRAM_API_KEY}`;
}

export function voiceAudioPersistEnabled(config: GatewayConfig): boolean {
  return config.VOICE_AUDIO_PERSIST_ENABLED === "true";
}

export function voiceAudioReady(config: GatewayConfig): string | null {
  if (!voiceAudioPersistEnabled(config)) {
    return null;
  }
  if (!config.AZURE_STORAGE_ACCOUNT) {
    return "AZURE_STORAGE_ACCOUNT is not set";
  }
  if (!config.AZURE_STORAGE_KEY) {
    return "AZURE_STORAGE_KEY is not set";
  }
  if (!config.AZURE_BLOB_CONTAINER) {
    return "AZURE_BLOB_CONTAINER is not set";
  }
  return null;
}

export function suppressedWarningCodes(config: GatewayConfig): Set<string> {
  return new Set(
    config.VOICE_SUPPRESSED_WARNING_CODES.split(/[,\s]+/)
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  );
}
