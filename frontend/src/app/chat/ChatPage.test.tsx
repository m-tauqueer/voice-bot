import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeStoredChatSessionId } from "../../lib/chatSession";
import { ChatPage } from "./ChatPage";

const sessionState = {
  status: "ready" as const,
  me: { id: "member", email: "member@example.com", owner: false },
  persona: null as null,
  reloadPersona: vi.fn(async () => undefined),
};

const apiMock = vi.fn();

vi.mock("../session", () => ({
  useSession: () => sessionState,
}));

vi.mock("../../lib/gateway", async () => {
  const actual = await vi.importActual<typeof import("../../lib/gateway")>(
    "../../lib/gateway",
  );
  return {
    ...actual,
    api: (...args: unknown[]) => apiMock(...args),
  };
});

const ada = {
  id: "11111111-1111-1111-1111-111111111111",
  handle: "ada",
  display_name: "Ada",
  description: "first",
};

const nova = {
  id: "22222222-2222-2222-2222-222222222222",
  handle: "nova",
  display_name: "Nova",
  description: null,
};

describe("ChatPage picker", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  beforeEach(() => {
    apiMock.mockReset();
    apiMock.mockResolvedValue({ personas: [ada, nova] });
  });

  it("keeps send disabled until a published persona is picked", async () => {
    render(<ChatPage />);
    expect(await screen.findByRole("button", { name: /@ada/i })).toBeTruthy();
    expect(screen.getByText("Pick someone first.")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /@ada/i }));
    expect(await screen.findByRole("heading", { name: "Ada" })).toBeTruthy();
    expect(screen.getByText("Say something. Memory stays with this persona.")).toBeTruthy();
  });

  it("shows empty copy when nothing is published", async () => {
    apiMock.mockResolvedValue({ personas: [] });
    render(<ChatPage />);
    expect(await screen.findByText("No published personas yet.")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("keeps Ada and Nova sittings on separate stored pins", async () => {
    const adaSession = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const novaSession = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    writeStoredChatSessionId("member", ada.id, adaSession);
    writeStoredChatSessionId("member", nova.id, novaSession);
    apiMock.mockImplementation(async (path: string) => {
      if (path === "/api/personas") {
        return { personas: [ada, nova] };
      }
      if (path.includes(adaSession)) {
        return {
          persona: ada,
          session_id: adaSession,
          turns: [{ ordinal: 1, speaker: "user", text: "ada hello" }],
        };
      }
      if (path.includes(novaSession)) {
        return {
          persona: nova,
          session_id: novaSession,
          turns: [{ ordinal: 1, speaker: "user", text: "nova hello" }],
        };
      }
      throw new Error(`unexpected ${path}`);
    });
    render(<ChatPage />);
    fireEvent.click(await screen.findByRole("button", { name: /@ada/i }));
    expect(await screen.findByText("ada hello")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /@nova/i }));
    expect(await screen.findByText("nova hello")).toBeTruthy();
    expect(screen.queryByText("ada hello")).toBeNull();
    await waitFor(() => {
      expect(apiMock.mock.calls.some((call) => String(call[0]).includes(novaSession))).toBe(
        true,
      );
    });
  });
});
