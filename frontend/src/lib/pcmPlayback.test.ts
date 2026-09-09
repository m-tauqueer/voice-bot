import { describe, expect, it } from "vitest";
import { createPlaybackLevel } from "./pcmPlayback";

describe("createPlaybackLevel", () => {
  it("keeps speak gain across the next enqueue after duck is not called", () => {
    const level = createPlaybackLevel(1, 0.25);
    expect(level.target()).toBe(1);
  });

  it("stays ducked until restore or flush", () => {
    const level = createPlaybackLevel(1, 0.25);
    expect(level.duck()).toBe(0.25);
    expect(level.target()).toBe(0.25);
    expect(level.target()).toBe(0.25);
    expect(level.restore()).toBe(1);
    expect(level.target()).toBe(1);
  });

  it("returns silence on flush and speaks at full gain after", () => {
    const level = createPlaybackLevel(1, 0.25);
    level.duck();
    expect(level.afterFlush()).toBe(0);
    expect(level.target()).toBe(1);
  });
});
