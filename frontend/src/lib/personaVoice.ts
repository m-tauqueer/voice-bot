import { requiredVite } from "./env";

export function personaPinField(): string {
  return requiredVite("VITE_PERSONA_ID_QUERY");
}

export function personaTtsKey(): string {
  return requiredVite("VITE_PERSONA_VOICE_TTS_KEY");
}

export function personaFishKey(): string {
  return requiredVite("VITE_PERSONA_VOICE_FISH_KEY");
}

export function adminPersonaQuery(id: string): string {
  return `${personaPinField()}=${encodeURIComponent(id)}`;
}

function voiceId(raw: unknown): string {
  return typeof raw === "string" ? raw : "";
}

export function splitVoiceConfig(
  voice: Record<string, unknown>,
  ttsKey: string,
  fishKey: string,
): { ttsVoice: string; fishVoice: string; style: Record<string, unknown> } {
  const style = { ...voice };
  const ttsRaw = style[ttsKey];
  const fishRaw = style[fishKey];
  delete style[ttsKey];
  delete style[fishKey];
  return {
    ttsVoice: voiceId(ttsRaw),
    fishVoice: voiceId(fishRaw),
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

export function mergePersonaVoices(
  style: Record<string, unknown>,
  ttsVoice: string,
  ttsKey: string,
  fishVoice: string,
  fishKey: string,
): Record<string, unknown> {
  const next = { ...style };
  delete next[ttsKey];
  delete next[fishKey];
  return mergeVoiceConfig(
    mergeVoiceConfig(next, ttsVoice, ttsKey),
    fishVoice,
    fishKey,
  );
}
