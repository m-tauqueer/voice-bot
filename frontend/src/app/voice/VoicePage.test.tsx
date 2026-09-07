import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VoicePage } from "./VoicePage";

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

describe("VoicePage picker", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    apiMock.mockReset();
    apiMock.mockResolvedValue({ personas: [ada, nova] });
  });

  it("lists published personas and keeps start disabled until one is picked", async () => {
    render(<VoicePage />);
    expect(await screen.findByRole("button", { name: /@ada/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /@nova/i })).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Start call" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /@ada/i }));
    expect(screen.getByRole("heading", { name: "Ada" })).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Start call" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("shows empty copy when nothing is published", async () => {
    apiMock.mockResolvedValue({ personas: [] });
    render(<VoicePage />);
    expect(
      await screen.findByText("No published personas yet."),
    ).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Start call" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
