import { requiredVite } from "./env";

export function personaPinField(): string {
  return requiredVite("VITE_PERSONA_ID_QUERY");
}

export function personaTtsKey(): string {
  return requiredVite("VITE_PERSONA_VOICE_TTS_KEY");
}

export function adminPersonaQuery(id: string): string {
  return `${personaPinField()}=${encodeURIComponent(id)}`;
}

export function splitVoiceConfig(
  voice: Record<string, unknown>,
  ttsKey: string,
): { ttsVoice: string; style: Record<string, unknown> } {
  const style = { ...voice };
  const raw = style[ttsKey];
  delete style[ttsKey];
  return {
    ttsVoice: typeof raw === "string" ? raw : "",
    style,
  };
}

export function mergeVoiceConfig(
  style: Record<string, unknown>,
  ttsVoice: string,
  ttsKey: string,
): Record<string, unknown> {
  const next = { ...style };
  const trimmed = ttsVoice.trim();
  if (trimmed) {
    next[ttsKey] = trimmed;
  } else {
    delete next[ttsKey];
  }
  return next;
}
