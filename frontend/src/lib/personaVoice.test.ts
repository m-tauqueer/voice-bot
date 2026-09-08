import { describe, expect, it } from "vitest";
import {
  adminPersonaQuery,
  mergePersonaVoices,
  mergeVoiceConfig,
  personaFishKey,
  personaPinField,
  personaTtsKey,
  splitVoiceConfig,
} from "./personaVoice";

describe("persona voice config", () => {
  it("reads the configured pin and tts keys", () => {
    expect(personaPinField()).toBe("persona_id");
    expect(personaTtsKey()).toBe("tts_voice");
    expect(personaFishKey()).toBe("fish_voice");
    expect(adminPersonaQuery("11111111-1111-1111-1111-111111111111")).toBe(
      "persona_id=11111111-1111-1111-1111-111111111111",
    );
  });

  it("splits both voice ids out of style rules", () => {
    expect(
      splitVoiceConfig(
        {
          tts_voice: "aura-2-thalia-en",
          fish_voice: "fish-ref-1",
          pace: "calm",
        },
        "tts_voice",
        "fish_voice",
      ),
    ).toEqual({
      ttsVoice: "aura-2-thalia-en",
      fishVoice: "fish-ref-1",
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

  it("writes a fish id onto the fish key only", () => {
    expect(
      mergePersonaVoices(
        { pace: "calm", tts_voice: "keep", fish_voice: "old" },
        "aura-2-aries-en",
        "tts_voice",
        "fish-ref-2",
        "fish_voice",
      ),
    ).toEqual({
      pace: "calm",
      tts_voice: "aura-2-aries-en",
      fish_voice: "fish-ref-2",
    });
    expect(
      mergePersonaVoices(
        { pace: "calm", fish_voice: "old" },
        "aura-2-luna-en",
        "tts_voice",
        "  ",
        "fish_voice",
      ),
    ).toEqual({ pace: "calm", tts_voice: "aura-2-luna-en" });
  });
});
