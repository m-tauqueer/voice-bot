import { describe, expect, it } from "vitest";
import {
  adminPersonaQuery,
  mergeVoiceConfig,
  personaPinField,
  personaTtsKey,
  splitVoiceConfig,
} from "./personaVoice";

describe("persona voice config", () => {
  it("reads the configured pin and tts keys", () => {
    expect(personaPinField()).toBe("persona_id");
    expect(personaTtsKey()).toBe("tts_voice");
    expect(adminPersonaQuery("11111111-1111-1111-1111-111111111111")).toBe(
      "persona_id=11111111-1111-1111-1111-111111111111",
    );
  });

  it("splits the tts id out of style rules", () => {
    expect(
      splitVoiceConfig(
        { tts_voice: "aura-2-thalia-en", pace: "calm" },
        "tts_voice",
      ),
    ).toEqual({
      ttsVoice: "aura-2-thalia-en",
      style: { pace: "calm" },
    });
  });

  it("writes or clears the tts id without treating it as style", () => {
    expect(mergeVoiceConfig({ pace: "calm" }, "aura-2-aries-en", "tts_voice")).toEqual({
      pace: "calm",
      tts_voice: "aura-2-aries-en",
    });
    expect(
      mergeVoiceConfig({ pace: "calm", tts_voice: "old" }, "  ", "tts_voice"),
    ).toEqual({ pace: "calm" });
  });
});
