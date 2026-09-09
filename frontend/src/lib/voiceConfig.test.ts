import { describe, expect, it } from "vitest";
import { loadVoiceClientConfig } from "./voiceConfig";

describe("loadVoiceClientConfig", () => {
  it("loads speak and duck gains from env", () => {
    const config = loadVoiceClientConfig();
    expect(config.thinkingCueEnabled).toBe(false);
    expect(config.playbackSpeakGain).toBe(1);
    expect(config.playbackDuckGain).toBe(0.25);
  });
});
