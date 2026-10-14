import { describe, expect, it } from "vitest";
import {
  detectChallenge,
  discardWallCapture,
  isAutoClearingChallenge,
} from "./challenge";

describe("detectChallenge", () => {
  it("flags Cloudflare auto JS checks", () => {
    expect(detectChallenge("Just a moment... Checking your browser")).toBe(
      "Cloudflare challenge"
    );
    expect(detectChallenge("Checking your browser before accessing the site")).toBe(
      "Cloudflare challenge"
    );
  });

  it("flags Turnstile and verify-you-are-human walls", () => {
    expect(detectChallenge("Verify you are human to continue")).toBe("CAPTCHA");
    expect(detectChallenge("Please complete the Cloudflare Turnstile check")).toBe(
      "CAPTCHA"
    );
    expect(detectChallenge("cf-turnstile widget loading")).toBe("CAPTCHA");
  });

  it("flags Adherent-style Cloudflare managed challenge copy", () => {
    const adherentWall = [
      "Performing security verification",
      "This website uses a security service to protect against malicious bots",
      "Performance & security by Cloudflare",
      "Ray ID: 8a1b2c3d4e5f6a7b",
    ].join("\n");
    expect(detectChallenge(adherentWall)).toBe("Security verification");

    expect(
      detectChallenge(
        "div id=cf-browser-verification class=managed_challenge waiting"
      )
    ).toBe("Cloudflare challenge");
  });

  it("does not false-positive on security-vendor marketing copy", () => {
    expect(
      detectChallenge(
        "Bot protection for SaaS. Our platform stops scrapers without slowing buyers."
      )
    ).toBeNull();
    expect(
      detectChallenge(
        "Enterprise cybersecurity: protect APIs, stop bots, and reduce fraud."
      )
    ).toBeNull();
  });
});

describe("isAutoClearingChallenge", () => {
  it("only waits out Cloudflare JS challenges, not captchas", () => {
    expect(isAutoClearingChallenge("Cloudflare challenge")).toBe(true);
    expect(isAutoClearingChallenge("CAPTCHA")).toBe(false);
    expect(isAutoClearingChallenge("Cloudflare block")).toBe(false);
    expect(isAutoClearingChallenge("Security verification")).toBe(false);
    expect(isAutoClearingChallenge(null)).toBe(false);
  });
});

describe("discardWallCapture", () => {
  it("drops challenge JPEGs so a blocked capture never keeps the wall", () => {
    const wallJpeg = {
      device: "desktop" as const,
      dataUri: "data:image/jpeg;base64,WALL",
      width: 1280,
      height: 800,
    };
    const cleared = discardWallCapture({
      blockedReason: "Security verification",
      screenshots: [wallJpeg],
      heroShot: wallJpeg,
      bands: [{ y: 0, dataUri: wallJpeg.dataUri }],
    });
    expect(cleared.screenshots).toEqual([]);
    expect(cleared.heroShot).toBeNull();
    expect(cleared.bands).toEqual([]);
    expect(cleared.blockedReason).toBe("Security verification");
  });

  it("leaves usable captures alone when not blocked", () => {
    const shot = {
      device: "desktop" as const,
      dataUri: "data:image/jpeg;base64,OK",
      width: 1280,
      height: 800,
    };
    const same = discardWallCapture({
      blockedReason: null,
      screenshots: [shot],
      heroShot: shot,
      bands: [],
    });
    expect(same.screenshots).toHaveLength(1);
    expect(same.heroShot).toBe(shot);
  });
});
