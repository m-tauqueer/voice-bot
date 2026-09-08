import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminPage } from "./AdminPage";

const sessionState = {
  status: "ready" as const,
  me: { id: "owner", email: "owner@example.com", owner: true },
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
  engram_persona_id: "eng-ada",
  handle: "ada",
  display_name: "Ada",
  description: "first",
  voice_config: { tts_voice: "aura-2-thalia-en" },
  published: true,
};

const nova = {
  id: "22222222-2222-2222-2222-222222222222",
  engram_persona_id: "eng-nova",
  handle: "nova",
  display_name: "Nova",
  description: null,
  voice_config: {},
  published: false,
};

describe("AdminPage personas", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    apiMock.mockReset();
    sessionState.me = { id: "owner", email: "owner@example.com", owner: true };
    sessionState.reloadPersona.mockClear();
    apiMock.mockImplementation(async (path: string) => {
      if (typeof path === "string" && path.startsWith("/api/admin/persona")) {
        return {
          persona: null,
          personas: [ada, nova],
          engram: null,
          subscriptions: [],
        };
      }
      if (typeof path === "string" && path.startsWith("/api/admin/questions")) {
        return { questions: [], coverage: null };
      }
      return {};
    });
  });

  it("lists published and draft rows without mixing them into one editor", async () => {
    render(<AdminPage />);
    expect(await screen.findByRole("button", { name: /Ada/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Nova/ })).toBeTruthy();
    expect(screen.getAllByText("Published").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Draft").length).toBeGreaterThan(0);
    expect(screen.getByText("Select a persona first.")).toBeTruthy();
    expect(screen.queryByLabelText("TTS voice id")).toBeNull();
  });

  it("loads the selected persona including its tts id", async () => {
    render(<AdminPage />);
    fireEvent.click(await screen.findByRole("button", { name: /@ada/i }));
    expect(await screen.findByLabelText("TTS voice id")).toBeTruthy();
    const tts = screen.getByLabelText("TTS voice id") as HTMLInputElement;
    expect(tts.value).toBe("aura-2-thalia-en");
    expect(
      screen.getAllByRole("button", { name: "Unpublish" }).length,
    ).toBeGreaterThan(0);
  });

  it("puts publish next to the draft badge and posts the local flag", async () => {
    render(<AdminPage />);
    fireEvent.click(await screen.findByRole("button", { name: /@nova/i }));
    const publishButtons = await screen.findAllByRole("button", {
      name: "Publish",
    });
    expect(publishButtons.length).toBeGreaterThan(0);
    fireEvent.click(publishButtons[0]);
    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith(
        "/api/admin/persona/publish",
        expect.objectContaining({ method: "POST" }),
      );
    });
    const publishCall = apiMock.mock.calls.find(
      ([path]) => path === "/api/admin/persona/publish",
    );
    expect(JSON.parse(String(publishCall?.[1]?.body))).toEqual({
      persona_id: nova.id,
      published: true,
    });
  });

  it("asks before taking a published persona away from members", async () => {
    render(<AdminPage />);
    fireEvent.click(await screen.findByRole("button", { name: /@ada/i }));
    fireEvent.click(
      (await screen.findAllByRole("button", { name: "Unpublish" }))[0],
    );
    expect(
      await screen.findByText("Unpublish this persona?"),
    ).toBeTruthy();
    expect(
      apiMock.mock.calls.some(
        ([path]) => path === "/api/admin/persona/publish",
      ),
    ).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.queryByText("Unpublish this persona?")).toBeNull();
    });
    expect(
      apiMock.mock.calls.some(
        ([path]) => path === "/api/admin/persona/publish",
      ),
    ).toBe(false);
  });

  it("unpublishes locally once the owner confirms", async () => {
    render(<AdminPage />);
    fireEvent.click(await screen.findByRole("button", { name: /@ada/i }));
    fireEvent.click(
      (await screen.findAllByRole("button", { name: "Unpublish" }))[0],
    );
    await screen.findByText("Unpublish this persona?");
    const confirm = screen
      .getAllByRole("button", { name: "Unpublish" })
      .at(-1) as HTMLElement;
    fireEvent.click(confirm);
    await waitFor(() => {
      const call = apiMock.mock.calls.find(
        ([path]) => path === "/api/admin/persona/publish",
      );
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({
        persona_id: ada.id,
        published: false,
      });
    });
  });

  it("keeps destroy locked until the handle is typed exactly", async () => {
    render(<AdminPage />);
    fireEvent.click(await screen.findByRole("button", { name: /@ada/i }));
    const destroy = (await screen.findByRole("button", {
      name: "Destroy persona",
    })) as HTMLButtonElement;
    expect(destroy.disabled).toBe(true);

    const field = screen.getByLabelText("Handle", {
      selector: "input[value='']",
    });
    fireEvent.change(field, { target: { value: "Ada" } });
    expect(
      (screen.getByRole("button", { name: "Destroy persona" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    fireEvent.change(field, { target: { value: "ada" } });
    const armed = screen.getByRole("button", {
      name: "Destroy persona",
    }) as HTMLButtonElement;
    expect(armed.disabled).toBe(false);
    fireEvent.click(armed);
    await waitFor(() => {
      const call = apiMock.mock.calls.find(
        ([path]) => path === "/api/admin/persona/destroy",
      );
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({
        persona_id: ada.id,
        confirmation: "ada",
      });
    });
  });

  it("shows the link form when Engram create is forbidden", async () => {
    apiMock.mockImplementation(async (path: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        throw new (await import("../../lib/gateway")).ApiError(
          "Engram refused create; record a dashboard persona id instead",
          403,
          { error: "forbidden", reason: "create_forbidden" },
        );
      }
      if (typeof path === "string" && path.startsWith("/api/admin/persona")) {
        return {
          persona: null,
          personas: [ada, nova],
          engram: null,
          subscriptions: [],
        };
      }
      return { questions: [], coverage: null };
    });
    render(<AdminPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Add persona" }));
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Nova Two" },
    });
    fireEvent.change(screen.getByLabelText("Handle"), {
      target: { value: "nova-two" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create persona" }));
    expect(
      await screen.findByText(
        "Engram refused create. Paste an existing persona id and link it.",
      ),
    ).toBeTruthy();
    expect(screen.getByLabelText("Engram persona id")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Link persona" })).toBeTruthy();
  });
});
