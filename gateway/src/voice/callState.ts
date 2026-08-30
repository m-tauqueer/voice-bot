import type { Redis } from "ioredis";
import { z } from "zod";
import type { GatewayConfig } from "../config.js";

const callStateSchema = z.object({
  request_id: z.string().nullable(),
  session_id: z.string().uuid(),
  barge_in: z.boolean(),
});

export type VoiceCallState = z.infer<typeof callStateSchema>;

function callKey(config: GatewayConfig, sessionId: string): string {
  return `${config.VOICE_REDIS_KEY_PREFIX}${sessionId}`;
}

export async function writeVoiceCallState(
  redis: Redis,
  config: GatewayConfig,
  state: VoiceCallState,
): Promise<void> {
  await redis.set(
    callKey(config, state.session_id),
    JSON.stringify(state),
    "EX",
    config.VOICE_REDIS_TTL_SECONDS,
  );
}

export async function readVoiceCallState(
  redis: Redis,
  config: GatewayConfig,
  sessionId: string,
): Promise<VoiceCallState | null> {
  const raw = await redis.get(callKey(config, sessionId));
  if (!raw) {
    return null;
  }
  try {
    const parsed = callStateSchema.safeParse(JSON.parse(raw) as unknown);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function setVoiceBargeIn(
  redis: Redis,
  config: GatewayConfig,
  sessionId: string,
  bargeIn: boolean,
): Promise<void> {
  const current = await readVoiceCallState(redis, config, sessionId);
  if (!current) {
    return;
  }
  await writeVoiceCallState(redis, config, { ...current, barge_in: bargeIn });
}

export async function clearVoiceCallState(
  redis: Redis,
  config: GatewayConfig,
  sessionId: string,
): Promise<void> {
  await redis.del(callKey(config, sessionId));
}
