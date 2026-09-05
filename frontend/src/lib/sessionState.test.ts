import { describe, expect, it } from "vitest";
import { isHeldSessionStatus, sessionFromMeFetch } from "./sessionState";

describe("sessionFromMeFetch", () => {
  it("becomes ready on a successful member /api/me", () => {
    const me = {
      access: "active",
      id: "u1",
      email: "a@example.com",
      owner: false,
    };
    expect(sessionFromMeFetch({ ok: true, me })).toEqual({
      status: "ready",
      me: { id: "u1", email: "a@example.com", owner: false },
    });
  });

  it("stays ready when access is omitted but an id is present", () => {
    const me = { id: "u1", email: "a@example.com", owner: false };
    expect(sessionFromMeFetch({ ok: true, me })).toEqual({
      status: "ready",
      me,
    });
  });

  it("becomes waitlisted without exposing an id", () => {
    expect(
      sessionFromMeFetch({
        ok: true,
        me: { access: "waitlisted", email: "w@example.com", owner: false },
      }),
    ).toEqual({
      status: "waitlisted",
      me: { email: "w@example.com", owner: false },
    });
  });

  it("becomes denied or revoked from the access label", () => {
    expect(
      sessionFromMeFetch({
        ok: true,
        me: { access: "denied", email: "d@example.com", owner: false },
      }).status,
    ).toBe("denied");
    expect(
      sessionFromMeFetch({
        ok: true,
        me: { access: "revoked", email: "r@example.com", owner: false },
      }).status,
    ).toBe("revoked");
  });

  it("becomes signed_out on any failed /api/me", () => {
    expect(sessionFromMeFetch({ ok: false })).toEqual({
      status: "signed_out",
      me: null,
    });
  });

  it("classifies held access statuses", () => {
    expect(isHeldSessionStatus("waitlisted")).toBe(true);
    expect(isHeldSessionStatus("ready")).toBe(false);
  });
});
