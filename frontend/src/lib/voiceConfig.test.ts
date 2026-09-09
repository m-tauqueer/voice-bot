import { describe, expect, it } from "vitest";
import { loadVoiceClientConfig } from "./voiceConfig";

describe("loadVoiceClientConfig", () => {
  it("loads speak and duck gains from env", () => {
    const config = loadVoiceClientConfig();
    expect(config.thinkingCueEnabled).toBe(false);
    expect(config.playbackSpeakGain).toBe(1);
    expect(config.playbackDuckGain).toBe(0.25);
    expect(config.ringIdleAmplitude).toBe(0.06);
    expect(config.orbListening).toBe("listening");
    expect(config.orbThinking).toBe("working");
    expect(config.orbSpeaking).toBe("composing");
    expect(config.orbSize).toBe(20);
  });
});
