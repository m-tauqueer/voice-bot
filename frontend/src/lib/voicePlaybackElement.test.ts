import { describe, expect, it, vi } from "vitest";
import {
  attachMediaPlayback,
  VOICE_PLAYBACK_CLASS,
} from "./voicePlaybackElement";

describe("attachMediaPlayback", () => {
  it("plays the stream on a hidden inline audio element and removes it", async () => {
    const play = vi.fn().mockResolvedValue(undefined);
    const pause = vi.fn();
    const stream = {} as MediaStream;
    const doc = document.implementation.createHTMLDocument();
    const original = doc.createElement.bind(doc);
    vi.spyOn(doc, "createElement").mockImplementation((tagName: string) => {
      const el = original(tagName);
      if (tagName === "audio") {
        Object.defineProperty(el, "play", { value: play });
        Object.defineProperty(el, "pause", { value: pause });
      }
      return el;
    });

    const playback = attachMediaPlayback(stream, doc);
    const el = doc.body.querySelector("audio");
    expect(el).toBeTruthy();
    expect(el?.className).toBe(VOICE_PLAYBACK_CLASS);
    expect(el?.autoplay).toBe(true);
    expect(el?.getAttribute("playsinline")).toBe("");
    expect(el?.getAttribute("webkit-playsinline")).toBe("");
    expect(el?.srcObject).toBe(stream);

    await playback.start();
    expect(play).toHaveBeenCalledTimes(1);

    playback.stop();
    expect(pause).toHaveBeenCalledTimes(1);
    expect(doc.body.querySelector("audio")).toBeNull();
  });
});
