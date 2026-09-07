import { describe, expect, it } from "vitest";
import {
  clientVoiceWsUrl,
  frontendPathRedirect,
  isOwnerEmail,
  ownerEmails,
  postLoginRedirectUrl,
  readPersonaIdQuery,
} from "./config.js";
import { testConfig } from "./test/config.js";

describe("config helpers", () => {
  it("matches owner emails case-insensitively", () => {
    const config = testConfig({
      OWNER_EMAILS: "Owner@Example.com, other@x.com",
    });
    expect(ownerEmails(config)).toEqual(
      new Set(["owner@example.com", "other@x.com"]),
    );
    expect(isOwnerEmail("OWNER@example.com", config)).toBe(true);
    expect(isOwnerEmail("stranger@example.com", config)).toBe(false);
  });

  it("only accepts same-origin frontend paths", () => {
    const config = testConfig();
    expect(frontendPathRedirect(config, "/dashboard")).toBe("/dashboard");
    expect(frontendPathRedirect(config, "/chat?x=1")).toBe("/chat?x=1");
    expect(frontendPathRedirect(config, "//evil.example")).toBeUndefined();
    expect(
      frontendPathRedirect(config, "https://evil.example/phish"),
    ).toBeUndefined();
    expect(frontendPathRedirect(config, undefined)).toBeUndefined();
  });

  it("falls back post-login to the frontend origin", () => {
    expect(postLoginRedirectUrl(testConfig())).toBe("http://localhost:5188");
    expect(
      postLoginRedirectUrl(
        testConfig({
          POST_LOGIN_REDIRECT_URL: "http://localhost:5188/dashboard",
        }),
      ),
    ).toBe("http://localhost:5188/dashboard");
  });

  it("pins a sitting with a configurable persona query field", () => {
    const config = testConfig();
    expect(config.PERSONA_ID_QUERY).toBe("persona_id");
    expect(config.MEMORY_PANEL_NO_PERSONA).toBe(
      config.INSIGHTS_ERROR_NOT_FOUND,
    );
    expect(readPersonaIdQuery({ persona_id: "abc" }, config)).toBe("abc");
    expect(
      clientVoiceWsUrl(config, "11111111-1111-1111-1111-111111111111"),
    ).toBe(
      "ws://localhost:5188/ws/voice?persona_id=11111111-1111-1111-1111-111111111111",
    );
  });
});
