import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryPanel } from "./MemoryPanel";

const sessionState = {
  status: "ready" as const,
  me: { id: "user-a", email: "a@example.com", owner: false },
  persona: null,
  reloadPersona: async () => undefined,
};

const fetchPersonalMemories = vi.fn();

vi.mock("../session", () => ({
  useSession: () => sessionState,
}));

vi.mock("../../lib/insights", () => ({
  fetchPersonalMemories: () => fetchPersonalMemories(),
}));

describe("MemoryPanel", () => {
  beforeEach(() => {
    fetchPersonalMemories.mockReset();
    sessionState.status = "ready";
    sessionState.me = { id: "user-a", email: "a@example.com", owner: false };
    fetchPersonalMemories.mockResolvedValue({
      memories: [{ text: "private fact for a", tenant: "org:p:a" }],
    });
  });

  it("loads memories for the signed-in user", async () => {
    render(<MemoryPanel />);
    await waitFor(() => {
      expect(fetchPersonalMemories).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText("private fact for a")).toBeTruthy();
  });

  it("shows the empty copy when there are no memories", async () => {
    fetchPersonalMemories.mockResolvedValue({ memories: [] });
    render(<MemoryPanel />);
    expect(await screen.findByText("Nothing stored about you yet.")).toBeTruthy();
  });

  it("shows unavailable copy when the fetch fails", async () => {
    fetchPersonalMemories.mockRejectedValue(new Error("down"));
    render(<MemoryPanel />);
    expect(
      await screen.findByText(
        "Memory is unavailable right now. Your history is still here.",
      ),
    ).toBeTruthy();
  });

  it("refetches when the signed-in user id changes", async () => {
    const { rerender } = render(<MemoryPanel />);
    await waitFor(() => {
      expect(fetchPersonalMemories).toHaveBeenCalledTimes(1);
    });
    fetchPersonalMemories.mockResolvedValue({
      memories: [{ text: "private fact for b", tenant: "org:p:b" }],
    });
    sessionState.me = { id: "user-b", email: "b@example.com", owner: false };
    rerender(<MemoryPanel />);
    await waitFor(() => {
      expect(fetchPersonalMemories).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText("private fact for b")).toBeTruthy();
  });
});
