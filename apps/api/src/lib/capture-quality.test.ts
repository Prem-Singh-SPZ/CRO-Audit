import { describe, expect, it } from "vitest";
import type { PageContext } from "@cro/shared";
import {
  applyCaptureOutcome,
  assessCaptureQuality,
  copySellsLeadForm,
  emptySignals,
  finalizeIncompleteFlag,
  formFieldsLookStyled,
  hasVisibleLoadingChrome,
  authorCssApplied,
  inViewImagesReady,
  inViewMediaReady,
  layoutSnapshotsEqual,
  isConsentAcceptLabel,
  isLiveCaptureUsable,
  isNearWhiteLuma,
  shouldHideConsentNode,
  shouldRetryCapture,
} from "./capture-quality";

function ctx(partial: Partial<PageContext> = {}): PageContext {
  return {
    url: "https://example.com/",
    finalUrl: "https://example.com/",
    title: "Example",
    metaDescription: null,
    lang: "en",
    hasViewportMeta: true,
    isHttps: true,
    headings: { h1: ["Streamline contracts"], h2: [], h3: [] },
    buttons: [],
    ctaTexts: ["Get a demo"],
    navLinks: [],
    forms: [],
    images: { total: 0, withAlt: 0, withoutAlt: 0 },
    fonts: [],
    colors: [],
    wordCount: 80,
    copyText: "Streamline contract management. Get a demo.",
    hasTestimonials: false,
    hasPricing: false,
    hasTrustBadges: false,
    hasSocialProof: false,
    hasVideo: false,
    loadTimeMs: 1,
    blocked: false,
    blockReason: null,
    ...partial,
  };
}

const heroCopy =
  "Streamline contract management. Reduce cost. Get a demo. Work email.";

describe("copySellsLeadForm", () => {
  it("detects demo / trial / work-email intent", () => {
    expect(copySellsLeadForm(heroCopy)).toBe(true);
    expect(copySellsLeadForm("Read our latest engineering blog post.")).toBe(
      false
    );
  });
});

describe("assessCaptureQuality", () => {
  it("flags a wide empty above-the-fold column on a form-selling page", () => {
    const quality = assessCaptureQuality({
      signals: {
        ...emptySignals(),
        slots: [{ width: 520, height: 420, textLength: 0 }],
      },
      hasFormLandmark: false,
      copyText: heroCopy,
    });
    expect(quality.incompleteCapture).toBe(true);
    expect(quality.captureNote).toMatch(/hero form/i);
  });

  it("flags a collapsed form iframe", () => {
    const quality = assessCaptureQuality({
      signals: {
        ...emptySignals(),
        formIframes: [
          { width: 400, height: 12, label: "https://js.hsforms.net/forms/embed" },
        ],
        hasFormControl: true,
      },
      hasFormLandmark: false,
      copyText: heroCopy,
    });
    expect(quality.incompleteCapture).toBe(true);
    expect(quality.captureNote).toMatch(/iframe/i);
  });

  it("flags a missing form when copy clearly sells one", () => {
    const quality = assessCaptureQuality({
      signals: emptySignals(),
      hasFormLandmark: false,
      copyText: heroCopy,
    });
    expect(quality.incompleteCapture).toBe(true);
    expect(quality.captureNote).toMatch(/no form was visible/i);
  });

  it("does not flag a filled form column", () => {
    const quality = assessCaptureQuality({
      signals: {
        ...emptySignals(),
        hasFormControl: true,
        slots: [],
        formIframes: [
          { width: 400, height: 380, label: "https://js.hsforms.net/forms/embed" },
        ],
      },
      hasFormLandmark: true,
      copyText: heroCopy,
    });
    expect(quality.incompleteCapture).toBe(false);
    expect(quality.captureNote).toBeNull();
  });

  it("does not flag an empty decorative column on a blog with no form intent", () => {
    const quality = assessCaptureQuality({
      signals: {
        ...emptySignals(),
        slots: [{ width: 400, height: 300, textLength: 0 }],
      },
      hasFormLandmark: true,
      copyText: "How we think about contract design in 2026.",
    });
    expect(quality.incompleteCapture).toBe(false);
  });
});

describe("applyCaptureOutcome", () => {
  it("keeps blocked exclusive of incompleteCapture", () => {
    const blocked = applyCaptureOutcome(ctx({ blocked: true, blockReason: "CAPTCHA" }), {
      blockedReason: null,
      incompleteCapture: true,
      captureNote: "empty slot",
      dismissedConsent: false,
    });
    expect(blocked.blocked).toBe(true);
    expect(blocked.incompleteCapture).toBeUndefined();
    expect(blocked.captureNote).toBeNull();
    expect(blocked.liveTest).toBeUndefined();

    const fromShot = applyCaptureOutcome(ctx(), {
      blockedReason: "Cloudflare challenge",
      incompleteCapture: true,
      captureNote: "empty slot",
      dismissedConsent: false,
    });
    expect(fromShot.blocked).toBe(true);
    expect(fromShot.blockReason).toBe("Cloudflare challenge");
    expect(fromShot.incompleteCapture).toBeUndefined();
  });

  it("copies incomplete flags onto a real (unblocked) report", () => {
    const next = applyCaptureOutcome(ctx(), {
      blockedReason: null,
      incompleteCapture: true,
      captureNote: "Part of the page had not loaded.",
      dismissedConsent: true,
    });
    expect(next.blocked).toBe(false);
    expect(next.incompleteCapture).toBe(true);
    expect(next.captureNote).toMatch(/had not loaded/);
  });

  it("copies a live-test vendor onto a real page and drops it on a wall", () => {
    const next = applyCaptureOutcome(ctx(), {
      blockedReason: null,
      incompleteCapture: false,
      captureNote: null,
      dismissedConsent: false,
      liveTest: { vendor: "Spiralyze" },
    });
    expect(next.liveTest).toEqual({ vendor: "Spiralyze" });

    const blocked = applyCaptureOutcome(ctx(), {
      blockedReason: "Cloudflare challenge",
      incompleteCapture: false,
      captureNote: null,
      dismissedConsent: false,
      liveTest: { vendor: "Spiralyze" },
    });
    expect(blocked.liveTest).toBeUndefined();
  });
});

describe("shouldRetryCapture", () => {
  it("retries an empty unblocked pass", () => {
    expect(
      shouldRetryCapture({ screenshots: [], blockedReason: null })
    ).toBe(true);
  });

  it("retries a blank-shell block", () => {
    expect(
      shouldRetryCapture({
        screenshots: [],
        blockedReason: "Empty / non-rendered page",
      })
    ).toBe(true);
  });

  it("does not retry a WAF wall or a successful desktop shot", () => {
    expect(
      shouldRetryCapture({ screenshots: [], blockedReason: "WAF block" })
    ).toBe(false);
    expect(
      shouldRetryCapture({
        screenshots: [{ device: "desktop" }],
        blockedReason: null,
      })
    ).toBe(false);
  });
});

describe("isConsentAcceptLabel", () => {
  it("matches Fastly / OneTrust accept copy", () => {
    expect(isConsentAcceptLabel("Accept default settings")).toBe(true);
    expect(isConsentAcceptLabel("Accept Recommended")).toBe(true);
    expect(isConsentAcceptLabel("Allow recommended cookies")).toBe(true);
    expect(isConsentAcceptLabel("Accept All")).toBe(true);
    expect(isConsentAcceptLabel("Got it")).toBe(true);
  });

  it("does not match captcha or reject controls", () => {
    expect(isConsentAcceptLabel("I am not a robot")).toBe(false);
    expect(isConsentAcceptLabel("Verify you are human")).toBe(false);
    expect(isConsentAcceptLabel("Reject all")).toBe(false);
  });
});

describe("finalizeIncompleteFlag", () => {
  it("does not show a spinner note when form fields already exist", () => {
    const next = finalizeIncompleteFlag({
      fieldsReady: true,
      quality: {
        incompleteCapture: true,
        captureNote:
          "Part of the page had not loaded when we captured it — often the hero form.",
      },
      hasCollapsedIframe: false,
    });
    expect(next.incompleteCapture).toBe(false);
    expect(next.captureNote).toBeNull();
  });

  it("keeps a collapsed iframe as incomplete even when fields exist", () => {
    const next = finalizeIncompleteFlag({
      fieldsReady: true,
      quality: { incompleteCapture: true, captureNote: "empty slot" },
      hasCollapsedIframe: true,
    });
    expect(next.incompleteCapture).toBe(true);
    expect(next.captureNote).toMatch(/iframe/i);
  });

  it("sets the spinner note only when the form has no inputs", () => {
    const next = finalizeIncompleteFlag({
      fieldsReady: false,
      quality: { incompleteCapture: false, captureNote: null },
      hasCollapsedIframe: false,
    });
    expect(next.incompleteCapture).toBe(true);
    expect(next.captureNote).toMatch(/spinner, no fields/i);
  });
});

describe("isLiveCaptureUsable", () => {
  it("prefers a painted live desktop shot", () => {
    expect(
      isLiveCaptureUsable({
        blockedReason: null,
        screenshots: [{ device: "desktop" }],
        liveUsable: true,
      })
    ).toBe(true);
  });

  it("rejects blocked, missing, or flagged live shots", () => {
    expect(
      isLiveCaptureUsable({
        blockedReason: "WAF block",
        screenshots: [{ device: "desktop" }],
        liveUsable: true,
      })
    ).toBe(false);
    expect(
      isLiveCaptureUsable({
        blockedReason: null,
        screenshots: [],
        liveUsable: true,
      })
    ).toBe(false);
    expect(
      isLiveCaptureUsable({
        blockedReason: null,
        screenshots: [{ device: "desktop" }],
        liveUsable: false,
      })
    ).toBe(false);
  });
});

describe("isNearWhiteLuma", () => {
  it("flags a grid of white pixels", () => {
    const white = Array.from({ length: 20 }, () => ({ r: 255, g: 255, b: 255 }));
    expect(isNearWhiteLuma(white)).toBe(true);
  });

  it("does not flag a painted hero sample", () => {
    const mixed = [
      ...Array.from({ length: 4 }, () => ({ r: 255, g: 255, b: 255 })),
      { r: 30, g: 34, b: 42 },
      { r: 37, g: 99, b: 235 },
    ];
    expect(isNearWhiteLuma(mixed)).toBe(false);
  });
});

describe("formFieldsLookStyled", () => {
  it("accepts a stacked or 2-col first/last form", () => {
    expect(
      formFieldsLookStyled(640, [{ left: 0 }, { left: 0 }, { left: 0 }, { left: 0 }])
    ).toBe(true);
    expect(
      formFieldsLookStyled(640, [
        { left: 0 },
        { left: 320 },
        { left: 0 },
        { left: 0 },
        { left: 0 },
      ])
    ).toBe(true);
  });

  it("rejects a wide form with most fields in the right 40%", () => {
    expect(
      formFieldsLookStyled(800, [
        { left: 0 },
        { left: 420 },
        { left: 420 },
        { left: 420 },
        { left: 420 },
      ])
    ).toBe(false);
  });

  it("does not judge sparse or narrow forms", () => {
    expect(formFieldsLookStyled(800, [{ left: 500 }, { left: 500 }])).toBe(true);
    expect(
      formFieldsLookStyled(300, [{ left: 200 }, { left: 200 }, { left: 200 }])
    ).toBe(true);
  });
});

describe("shouldHideConsentNode", () => {
  it("hides a covering OneTrust banner", () => {
    expect(
      shouldHideConsentNode({
        tagName: "div",
        idc: "onetrust-banner-sdk",
        text: "We value your privacy",
        coverage: 0.3,
        containsFormOrField: false,
      })
    ).toBe(true);
  });

  it("does not hide a form or a wrapper that still has fields", () => {
    expect(
      shouldHideConsentNode({
        tagName: "form",
        idc: "lead-form",
        text: "See our Privacy Policy",
        coverage: 0.4,
        containsFormOrField: true,
      })
    ).toBe(false);
    expect(
      shouldHideConsentNode({
        tagName: "div",
        idc: "hero",
        text: "Accept default settings",
        coverage: 0.5,
        containsFormOrField: true,
      })
    ).toBe(false);
  });

  it("does not hide a node just because it mentions privacy", () => {
    expect(
      shouldHideConsentNode({
        tagName: "div",
        idc: "privacy-checkbox",
        text: "I'd like emails. Privacy Policy.",
        coverage: 0.2,
        containsFormOrField: false,
      })
    ).toBe(false);
  });
});

describe("authorCssApplied", () => {
  it("accepts padding, radius, or a non-UA font", () => {
    expect(
      authorCssApplied({
        paddingLeft: 12,
        borderRadius: 0,
        fontFamily: "Times New Roman",
      })
    ).toBe(true);
    expect(
      authorCssApplied({
        paddingLeft: 0,
        borderRadius: 6,
        fontFamily: "serif",
      })
    ).toBe(true);
    expect(
      authorCssApplied({
        paddingLeft: 0,
        borderRadius: 0,
        fontFamily: '"Inter", sans-serif',
      })
    ).toBe(true);
  });

  it("rejects an unstyled UA box", () => {
    expect(
      authorCssApplied({
        paddingLeft: 2,
        borderRadius: 0,
        fontFamily: "Times New Roman",
      })
    ).toBe(false);
    expect(
      authorCssApplied({
        paddingLeft: 0,
        borderRadius: 0,
        fontFamily: "serif",
      })
    ).toBe(false);
  });
});

describe("inViewMediaReady", () => {
  it("is ready when in-view images and SVGs have size", () => {
    expect(
      inViewMediaReady([
        {
          kind: "img",
          width: 120,
          height: 40,
          complete: true,
          naturalWidth: 240,
        },
        { kind: "svg", width: 80, height: 32 },
      ])
    ).toBe(true);
  });

  it("is not ready for a pending image or a 0x0 SVG", () => {
    expect(
      inViewMediaReady([
        {
          kind: "img",
          width: 120,
          height: 40,
          complete: false,
          naturalWidth: 0,
        },
      ])
    ).toBe(false);
    expect(
      inViewMediaReady([{ kind: "svg", width: 0, height: 0 }])
    ).toBe(false);
  });

  it("ignores 1x1 trackers and pages with no media", () => {
    expect(
      inViewMediaReady([
        {
          kind: "img",
          width: 1,
          height: 1,
          complete: false,
          naturalWidth: 0,
        },
      ])
    ).toBe(true);
    expect(inViewMediaReady([])).toBe(true);
  });
});

describe("layoutSnapshotsEqual", () => {
  const snap = {
    fieldCount: 2,
    mediaCount: 1,
    boxes: [
      { x: 40, y: 80, w: 400, h: 48 },
      { x: 40, y: 140, w: 400, h: 48 },
    ],
  };

  it("treats boxes within 2px as the same layout", () => {
    expect(
      layoutSnapshotsEqual(snap, {
        ...snap,
        boxes: [
          { x: 41, y: 81, w: 399, h: 49 },
          { x: 40, y: 140, w: 400, h: 48 },
        ],
      })
    ).toBe(true);
  });

  it("rejects a shift or a new field", () => {
    expect(
      layoutSnapshotsEqual(snap, {
        ...snap,
        boxes: [
          { x: 40, y: 80, w: 400, h: 48 },
          { x: 40, y: 200, w: 400, h: 48 },
        ],
      })
    ).toBe(false);
    expect(
      layoutSnapshotsEqual(snap, { ...snap, fieldCount: 3 })
    ).toBe(false);
  });
});

describe("inViewImagesReady", () => {
  it("is ready when in-view images are decoded", () => {
    expect(
      inViewImagesReady([
        { width: 120, height: 40, complete: true, naturalWidth: 240 },
        { width: 80, height: 32, complete: true, naturalWidth: 160 },
      ])
    ).toBe(true);
  });

  it("is not ready when a logo has not decoded", () => {
    expect(
      inViewImagesReady([
        { width: 120, height: 40, complete: true, naturalWidth: 240 },
        { width: 80, height: 32, complete: false, naturalWidth: 0 },
      ])
    ).toBe(false);
  });

  it("ignores 1x1 trackers", () => {
    expect(
      inViewImagesReady([
        { width: 1, height: 1, complete: false, naturalWidth: 0 },
        { width: 100, height: 36, complete: true, naturalWidth: 200 },
      ])
    ).toBe(true);
  });
});

describe("hasVisibleLoadingChrome", () => {
  it("flags a large Loading box", () => {
    expect(
      hasVisibleLoadingChrome([
        {
          text: "Loading…",
          className: "page-loading",
          ariaBusy: false,
          width: 400,
          height: 200,
        },
      ])
    ).toBe(true);
  });

  it("ignores an 8px chat dot", () => {
    expect(
      hasVisibleLoadingChrome([
        {
          text: "",
          className: "spinner",
          ariaBusy: true,
          width: 8,
          height: 8,
        },
      ])
    ).toBe(false);
  });
});
