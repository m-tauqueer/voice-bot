import { describe, expect, it } from "vitest";
import {
  captureHeld,
  captureHoldGapMs,
  emptyCaptureHold,
  noteCaptureHold,
  playbackHoldActive,
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

  it("sizes the mic-frame gap from the capture hop", () => {
    expect(captureHoldGapMs(320, 16000)).toBe(40);
  });

  it("holds until scheduled audio plus the sink pad, then opens", () => {
    const input = {
      stopped: false,
      sourceCount: 0,
      queued: true,
      lastAudioEnd: 1,
      padSec: 2.5,
      now: 3.4,
    };
    expect(playbackHoldActive(input)).toBe(true);
    expect(playbackHoldActive({ ...input, now: 3.5 })).toBe(false);
  });

  it("does not hold before audio is queued or after a flush", () => {
    expect(
      playbackHoldActive({
        stopped: false,
        sourceCount: 0,
        queued: false,
        lastAudioEnd: 0,
        now: 0.2,
        padSec: 2.5,
      }),
    ).toBe(false);
  });

  it("stays active while a source is still scheduled", () => {
    expect(
      playbackHoldActive({
        stopped: false,
        sourceCount: 1,
        queued: true,
        lastAudioEnd: 0,
        now: 9,
        padSec: 2.5,
      }),
    ).toBe(true);
  });
});
