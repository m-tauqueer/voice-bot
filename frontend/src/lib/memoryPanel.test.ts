import { describe, expect, it } from "vitest";
import { memoryPanelReloadKey } from "./memoryPanel";

describe("memoryPanelReloadKey", () => {
  it("changes when the signed-in user changes", () => {
    const first = memoryPanelReloadKey("user-a", "ready");
    const second = memoryPanelReloadKey("user-b", "ready");
    expect(first).not.toBe(second);
  });

  it("changes when session status changes", () => {
    expect(memoryPanelReloadKey("user-a", "ready")).not.toBe(
      memoryPanelReloadKey("user-a", "signed_out"),
    );
  });

  it("treats a missing user as empty", () => {
    expect(memoryPanelReloadKey(undefined, "loading")).toBe("loading:");
  });
});
