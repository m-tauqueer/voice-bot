import { describe, expect, it } from "vitest";
import {
  captureHeld,
  emptyCaptureHold,
  noteCaptureHold,
  playbackIsActive,
} from "./captureHold";

describe("captureHold", () => {
  it("is inactive until playback is marked", () => {
    expect(captureHeld(emptyCaptureHold(), 1000)).toBe(false);
  });

  it("holds through playback and the configured tail", () => {
    const held = noteCaptureHold(emptyCaptureHold(), true, 1000, 300);
    expect(captureHeld(held, 1000)).toBe(true);
    expect(captureHeld(held, 1299)).toBe(true);
    expect(captureHeld(held, 1300)).toBe(false);
  });

  it("keeps the later deadline when playback continues", () => {
    const first = noteCaptureHold(emptyCaptureHold(), true, 1000, 300);
    const second = noteCaptureHold(first, true, 1200, 300);
    expect(second.until).toBe(1500);
    const idle = noteCaptureHold(second, false, 1400, 300);
    expect(idle.until).toBe(1500);
  });

  it("opens capture once scheduled playback ends, without waiting on a later phase", () => {
    const during = noteCaptureHold(emptyCaptureHold(), true, 1000, 40);
    const after = noteCaptureHold(during, false, 1040, 40);
    expect(captureHeld(after, 1040)).toBe(false);
  });

  it("treats scheduled audio as playing", () => {
    expect(playbackIsActive(0, 1.2, 1.0)).toBe(true);
    expect(playbackIsActive(1, 0, 2.0)).toBe(true);
    expect(playbackIsActive(0, 1.0, 1.0)).toBe(false);
  });
});
