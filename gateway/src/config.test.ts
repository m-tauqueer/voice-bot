import { describe, expect, it } from "vitest";
import {
  frontendPathRedirect,
  isOwnerEmail,
  ownerEmails,
  postLoginRedirectUrl,
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
});
