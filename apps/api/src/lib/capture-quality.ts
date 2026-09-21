import type { PageContext } from "@cro/shared";

/** Large above-the-fold box with almost no content (late form column). */
export interface EmptySlot {
  width: number;
  height: number;
  textLength: number;
}

export interface FormIframeSignal {
  width: number;
  height: number;
  label: string;
}

export interface CaptureSignals {
  viewportWidth: number;
  viewportHeight: number;
  slots: EmptySlot[];
  formIframes: FormIframeSignal[];
  hasFormControl: boolean;
  overlayCoverage: number;
}

export interface CaptureQuality {
  incompleteCapture: boolean;
  captureNote: string | null;
}

export interface ScreenshotCaptureFlags {
  blockedReason: string | null;
  incompleteCapture: boolean;
  captureNote: string | null;
  dismissedConsent: boolean;
  liveTest?: { vendor: string } | null;
}

/** CDP died mid-walk — keep any JPEG we already have instead of aborting. */
export function isDeadPageError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /detached frame|target closed|session closed|connection closed|browser has been closed|protocol error/i.test(
    msg
  );
}

/** Retry only when the first pass produced no desktop shot and was not a hard wall. */
export function shouldRetryCapture(shot: {
  screenshots: { device: string }[];
  blockedReason: string | null;
}): boolean {
  if (shot.screenshots.some((s) => s.device === "desktop")) return false;
  if (shot.blockedReason && !/empty|non-rendered/i.test(shot.blockedReason)) {
    return false;
  }
  return true;
}

/**
 * Prefer the live viewport when we have a painted desktop shot and the hero
 * form (if any) already has fields. Blocked / blank / cookie-covered / spinner
 * live shots fall through to Archive.
 */
export function isLiveCaptureUsable(shot: {
  blockedReason: string | null;
  screenshots: { device: string }[];
  liveUsable?: boolean;
}): boolean {
  if (shot.blockedReason) return false;
  if (!shot.screenshots.some((s) => s.device === "desktop")) return false;
  if (shot.liveUsable === false) return false;
  return true;
}

/**
 * After we know whether a <form> has real inputs, drop the false "spinner,
 * no fields" / empty-slot banner. Keep collapsed-iframe as the only
 * incomplete case when fields are already visible.
 */
export function finalizeIncompleteFlag(input: {
  fieldsReady: boolean;
  quality: CaptureQuality;
  hasCollapsedIframe: boolean;
}): CaptureQuality {
  if (input.fieldsReady) {
    if (input.hasCollapsedIframe) {
      return {
        incompleteCapture: true,
        captureNote:
          "A form embed was present but had not finished loading (collapsed iframe).",
      };
    }
    return { incompleteCapture: false, captureNote: null };
  }
  return {
    incompleteCapture: true,
    captureNote:
      input.quality.captureNote ??
      "The hero form was still loading (spinner, no fields) when we captured the page.",
  };
}

/** Fastly / OneTrust / common CMP accept copy. Not for captcha controls. */
export function isConsentAcceptLabel(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t || t.length > 80) return false;
  if (/(robot|captcha|challenge|verify you)/i.test(t)) return false;
  return /accept all|accept default|accept recommended|allow all|allow recommended|allow cookies|i agree|^accept$|^agree$|^allow$|got it|agree and/i.test(
    t
  );
}

const LEAD_FORM_COPY =
  /(request|book|get|schedule)\s+(a\s+)?demo|\bstart (your )?(free )?trial\b|\bwork email\b|\bcontact sales\b|\bfirst name\b/i;

export function copySellsLeadForm(copy: string): boolean {
  return LEAD_FORM_COPY.test(copy);
}

export function emptySignals(): CaptureSignals {
  return {
    viewportWidth: 1440,
    viewportHeight: 900,
    slots: [],
    formIframes: [],
    hasFormControl: false,
    overlayCoverage: 0,
  };
}

/** Near-white pixel ratio used to reject an unpainted viewport JPEG. */
export function isNearWhiteLuma(
  samples: { r: number; g: number; b: number }[]
): boolean {
  if (samples.length === 0) return false;
  const near = samples.filter((p) => {
    const luma = 0.2126 * p.r + 0.7152 * p.g + 0.0722 * p.b;
    const chroma = Math.max(p.r, p.g, p.b) - Math.min(p.r, p.g, p.b);
    return luma >= 245 && chroma <= 12;
  });
  return near.length / samples.length >= 0.88;
}

/**
 * Paint / visibility ready-check for waitForFunction.
 * Self-contained — never use innerText length (nav/mega-menus lie).
 */
export function pageHasPaintedContent(): boolean {
  const state = document.readyState;
  if (state !== "interactive" && state !== "complete") return false;
  const vw = window.innerWidth || 1440;
  const vh = window.innerHeight || 900;
  const nodes = document.querySelectorAll(
    "h1, h2, [role=main], main, form, input[type=email], input:not([type=hidden]), textarea, img, video"
  );
  let visible = false;
  for (const el of Array.from(nodes)) {
    if (!(el instanceof HTMLElement)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 20) continue;
    if (r.bottom < 8 || r.top > vh - 8 || r.right < 8 || r.left > vw - 8) {
      continue;
    }
    const st = getComputedStyle(el);
    if (
      st.visibility === "hidden" ||
      st.display === "none" ||
      Number(st.opacity) === 0
    ) {
      continue;
    }
    if (el instanceof HTMLImageElement && el.naturalWidth < 20) continue;
    visible = true;
    break;
  }
  return visible;
}

/**
 * True when most in-viewport sample points have no painted content
 * (white hero under a fat nav). Self-contained for page.evaluate.
 */
export function isViewportVisuallyBlank(): boolean {
  const vw = window.innerWidth || 1440;
  const vh = window.innerHeight || 900;
  const nearWhite = (color: string): boolean => {
    const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (!m) return false;
    const r = Number(m[1]);
    const g = Number(m[2]);
    const b = Number(m[3]);
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);
    return luma >= 245 && chroma <= 12;
  };
  const painted = (start: Element): boolean => {
    let node: Element | null = start;
    for (let i = 0; i < 6 && node; i++) {
      if (node instanceof HTMLImageElement && node.naturalWidth >= 20) {
        return true;
      }
      if (
        node instanceof HTMLInputElement ||
        node instanceof HTMLTextAreaElement ||
        node instanceof HTMLSelectElement
      ) {
        const box = node.getBoundingClientRect();
        if (box.width >= 24 && box.height >= 16) return true;
      }
      if (node instanceof HTMLIFrameElement) {
        const box = node.getBoundingClientRect();
        if (box.width >= 80 && box.height >= 40) return true;
      }
      const st = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      const ownText = Array.from(node.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => (n.textContent || "").replace(/\s+/g, " ").trim())
        .join(" ");
      if (
        ownText.length >= 8 &&
        !nearWhite(st.color) &&
        box.height < vh * 0.45 &&
        box.width < vw * 0.92
      ) {
        return true;
      }
      if (st.backgroundImage && st.backgroundImage !== "none") return true;
      node = node.parentElement;
    }
    return false;
  };
  const xs = [0.2, 0.4, 0.5, 0.6, 0.8];
  const ys = [0.22, 0.4, 0.55, 0.7];
  let blank = 0;
  let total = 0;
  for (const y of ys) {
    for (const x of xs) {
      total += 1;
      const el = document.elementFromPoint(vw * x, vh * y);
      if (!el || el === document.documentElement || el === document.body) {
        blank += 1;
        continue;
      }
      if (!painted(el)) blank += 1;
    }
  }
  return total > 0 && blank / total >= 0.8;
}

/**
 * If the page has a <form>, true only when that form contains a real input.
 * No form → true (nothing to wait for). Self-contained for page.evaluate.
 */
export function pageHasHeroControl(): boolean {
  const forms = Array.from(document.querySelectorAll("form"));
  if (forms.length === 0) return true;

  const vw = window.innerWidth || 1440;
  const vh = window.innerHeight || 900;
  const visible = (el: Element | null): el is HTMLElement => {
    if (!(el instanceof HTMLElement)) return false;
    const st = getComputedStyle(el);
    if (
      st.display === "none" ||
      st.visibility === "hidden" ||
      Number(st.opacity) === 0
    ) {
      return false;
    }
    const r = el.getBoundingClientRect();
    return (
      r.width >= 32 &&
      r.height >= 14 &&
      r.bottom > 0 &&
      r.top < vh &&
      r.right > 0 &&
      r.left < vw
    );
  };

  const formHasInput = (form: HTMLFormElement): boolean => {
    const fields = form.querySelectorAll("input, textarea, select");
    for (const el of Array.from(fields)) {
      if (el instanceof HTMLInputElement) {
        const t = el.type.toLowerCase();
        if (
          t === "hidden" ||
          t === "submit" ||
          t === "button" ||
          t === "image" ||
          t === "checkbox" ||
          t === "radio" ||
          t === "file"
        ) {
          continue;
        }
      }
      if (visible(el)) return true;
    }
    const iframe = form.querySelector("iframe");
    if (iframe instanceof HTMLElement) {
      const r = iframe.getBoundingClientRect();
      if (visible(iframe) && r.width >= 200 && r.height >= 80) return true;
    }
    return false;
  };

  return forms.some((form) => formHasInput(form));
}

/**
 * Measures empty hero slots, collapsed form iframes, and consent overlay
 * coverage. Self-contained for page.evaluate.
 */
export function collectCaptureSignalsInPage(): CaptureSignals {
  const vw = window.innerWidth || 1440;
  const vh = window.innerHeight || 900;
  const slots: EmptySlot[] = [];
  const nodes = Array.from(
    document.querySelectorAll("div, section, aside, article")
  );
  let checked = 0;
  for (const el of nodes) {
    if (checked >= 250) break;
    const r = el.getBoundingClientRect();
    if (r.width < vw * 0.25 || r.height < 200) continue;
    if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
    checked += 1;
    const text = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (text.length > 80) continue;
    const hasMedia = Boolean(
      el.querySelector("img, video, svg, canvas, picture")
    );
    const hasControl = Boolean(
      el.querySelector("input, textarea, select, button, iframe, a[href]")
    );
    if (hasMedia || hasControl) continue;
    if (r.width > vw * 0.92 && r.height > vh * 0.85) continue;
    slots.push({
      width: r.width,
      height: r.height,
      textLength: text.length,
    });
  }

  const formIframes: FormIframeSignal[] = [];
  for (const f of Array.from(document.querySelectorAll("iframe"))) {
    const label = `${f.getAttribute("src") ?? ""} ${f.getAttribute("title") ?? ""}`;
    if (
      !/hsforms|hubspot|marketo|pardot|typeform|calendly|chilipiper|\bform\b/i.test(
        label
      )
    ) {
      continue;
    }
    const r = f.getBoundingClientRect();
    formIframes.push({
      width: r.width,
      height: r.height,
      label: label.trim().slice(0, 120),
    });
  }

  let overlayCoverage = 0;
  for (const el of Array.from(
    document.querySelectorAll("div, section, aside, dialog, [role=dialog]")
  )) {
    const idc = `${el.id} ${el.className} ${el.getAttribute("aria-label") ?? ""}`.toLowerCase();
    const role = el.getAttribute("role");
    const text = (el.textContent || "").slice(0, 280).toLowerCase();
    const looksConsent =
      /cookie|consent|onetrust|gdpr|privacy/.test(idc) ||
      role === "dialog" ||
      /we value your privacy|accept default settings|manage cookie/.test(text);
    if (!looksConsent) continue;
    const r = el.getBoundingClientRect();
    const w = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
    const h = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    const cov = (w * h) / Math.max(vw * vh, 1);
    // Ignore the full-page wrapper that merely contains the modal.
    if (cov > 0.92) continue;
    overlayCoverage = Math.max(overlayCoverage, cov);
  }

  return {
    viewportWidth: vw,
    viewportHeight: vh,
    slots,
    formIframes,
    hasFormControl: Boolean(
      document.querySelector(
        'input[type="email"], input[type="text"], input[type="tel"], textarea'
      ) ||
        document.querySelector(
          "iframe[src*='hsforms' i], iframe[src*='hubspot' i], iframe[src*='marketo' i], iframe[src*='pardot' i], iframe[src*='typeform' i], iframe[src*='calendly' i], iframe[src*='chilipiper' i]"
        )
    ),
    overlayCoverage,
  };
}

/**
 * Click a common Accept control on a covering consent overlay. Never clicks
 * captcha / "I am not a robot" controls. Returns true if a click happened.
 * Self-contained for page.evaluate — keep the accept regex inlined.
 */
export function dismissConsentInPage(): boolean {
  const vw = window.innerWidth || 1440;
  const vh = window.innerHeight || 900;
  const isAccept = (raw: string): boolean => {
    const t = raw.replace(/\s+/g, " ").trim();
    if (!t || t.length > 80) return false;
    if (/(robot|captcha|challenge|verify you)/i.test(t)) return false;
    return /accept all|accept default|accept recommended|allow all|allow recommended|allow cookies|i agree|^accept$|^agree$|^allow$|got it|agree and/i.test(
      t
    );
  };

  const inLeadForm = (el: Element): boolean => Boolean(el.closest("form"));

  const known = document.querySelector("#onetrust-accept-btn-handler");
  if (known instanceof HTMLElement && !inLeadForm(known)) {
    known.click();
    return true;
  }

  let overlay: HTMLElement | null = null;
  let coverage = 0;
  for (const el of Array.from(
    document.querySelectorAll("div, section, aside, dialog, [role=dialog]")
  )) {
    if (!(el instanceof HTMLElement)) continue;
    const idc = `${el.id} ${el.className} ${el.getAttribute("aria-label") ?? ""}`.toLowerCase();
    const role = el.getAttribute("role");
    if (!/cookie|consent|onetrust|gdpr|privacy/.test(idc) && role !== "dialog") {
      continue;
    }
    // Never treat the lead form card as a CMP overlay (Privacy Policy copy).
    if (el.querySelector("form, input[type=email], textarea")) continue;
    const r = el.getBoundingClientRect();
    const w = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
    const h = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    const cov = (w * h) / Math.max(vw * vh, 1);
    if (cov > coverage) {
      coverage = cov;
      overlay = el;
    }
  }
  // Bottom banners often cover less than a quarter of the viewport.
  if (coverage >= 0.08 && overlay) {
    const controls = overlay.querySelectorAll("button, a, [role=button]");
    for (const raw of Array.from(controls)) {
      if (!(raw instanceof HTMLElement)) continue;
      if (inLeadForm(raw)) continue;
      if (isAccept(raw.textContent || "")) {
        raw.click();
        return true;
      }
    }
  }

  for (const root of Array.from(
    document.querySelectorAll(
      '[id*="cookie" i], [id*="consent" i], [id*="onetrust" i], [class*="cookie" i], [class*="consent" i], [class*="onetrust" i]'
    )
  )) {
    for (const raw of Array.from(
      root.querySelectorAll("button, a, [role=button]")
    )) {
      if (!(raw instanceof HTMLElement)) continue;
      if (inLeadForm(raw)) continue;
      if (isAccept(raw.textContent || "")) {
        raw.click();
        return true;
      }
    }
  }

  // Fastly-style modal: accept copy is unique, but the wrapper may not
  // mention onetrust/cookie in id/class. Never click inside the lead <form>
  // — "I agree" / "Accept" next to Privacy Policy is not CMP.
  for (const raw of Array.from(
    document.querySelectorAll("button, a, [role=button]")
  )) {
    if (!(raw instanceof HTMLElement)) continue;
    if (inLeadForm(raw)) continue;
    if (!isAccept(raw.textContent || "")) continue;
    const scope = raw.closest("div, section, aside, dialog, [role=dialog]");
    const ctx = (scope?.textContent || "").slice(0, 400).toLowerCase();
    if (/cookie|privacy|consent|gdpr/.test(ctx)) {
      raw.click();
      return true;
    }
  }
  return false;
}

/**
 * Whether a covering node is CMP chrome we may hide. Never hides a form or
 * a wrapper that still contains the lead form — that collapsed Fastly's grid.
 * Bare "privacy" in class/id is not enough (Privacy Policy on the form).
 */
export function shouldHideConsentNode(input: {
  tagName: string;
  idc: string;
  text: string;
  coverage: number;
  containsFormOrField: boolean;
}): boolean {
  if (input.containsFormOrField) return false;
  if (input.tagName.toLowerCase() === "form") return false;
  if (input.coverage < 0.12 || input.coverage > 0.92) return false;
  const idc = input.idc.toLowerCase();
  const text = input.text.toLowerCase();
  if (/main|article/.test(idc) && !/cookie|consent|onetrust/.test(idc)) {
    return false;
  }
  return (
    /cookie|consent|onetrust|gdpr|ot-sdk|privacy-banner|cookie-banner/.test(
      idc
    ) ||
    /we value your privacy|cookie settings|accept default settings|accept recommended|manage (cookie|choices)/.test(
      text
    )
  );
}

/**
 * Wide form + most fields in the right half = CSS grid never applied.
 * 1–2 fields: geometry is inconclusive (CSS check is separate). Do not
 * treat a short field list as “styled.”
 */
export function formFieldsLookStyled(
  formWidth: number,
  fields: { left: number }[]
): boolean {
  if (fields.length < 3) return true;
  if (formWidth < 400) return true;
  const mid = formWidth * 0.45;
  const rightish = fields.filter((f) => f.left > mid).length;
  return rightish < fields.length - 1;
}

export interface AuthorCssSignal {
  paddingLeft: number;
  borderRadius: number;
  fontFamily: string;
}

/** Author stylesheet landed — not an unstyled UA box. Works for input or h1. */
export function authorCssApplied(style: AuthorCssSignal): boolean {
  if (style.paddingLeft >= 10) return true;
  if (style.borderRadius >= 4) return true;
  const font = style.fontFamily.replace(/["']/g, "").trim().toLowerCase();
  if (!font) return false;
  if (/^(times|times new roman|serif|initial|inherit)(,|$)/.test(font)) {
    return false;
  }
  return true;
}

export interface LayoutBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutSnapshot {
  fieldCount: number;
  mediaCount: number;
  boxes: LayoutBox[];
}

export function layoutSnapshotsEqual(
  a: LayoutSnapshot,
  b: LayoutSnapshot,
  slop = 2
): boolean {
  if (a.fieldCount !== b.fieldCount) return false;
  if (a.mediaCount !== b.mediaCount) return false;
  if (a.boxes.length !== b.boxes.length) return false;
  for (let i = 0; i < a.boxes.length; i++) {
    const left = a.boxes[i]!;
    const right = b.boxes[i]!;
    if (
      Math.abs(left.x - right.x) > slop ||
      Math.abs(left.y - right.y) > slop ||
      Math.abs(left.w - right.w) > slop ||
      Math.abs(left.h - right.h) > slop
    ) {
      return false;
    }
  }
  return true;
}

/** In-viewport boxes for h1 / form / fields / img / svg. Self-contained. */
export function collectLayoutSnapshotInPage(): LayoutSnapshot {
  const vw = window.innerWidth || 1440;
  const vh = window.innerHeight || 900;
  const inView = (el: Element): DOMRect | null => {
    if (!(el instanceof HTMLElement) && !(el instanceof SVGElement)) return null;
    const st = getComputedStyle(el);
    if (
      st.display === "none" ||
      st.visibility === "hidden" ||
      Number(st.opacity) === 0
    ) {
      return null;
    }
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) return null;
    return r;
  };
  const boxes: LayoutBox[] = [];
  const push = (r: DOMRect | null) => {
    if (!r || r.width < 8 || r.height < 8) return;
    boxes.push({
      x: Math.round(r.left),
      y: Math.round(r.top),
      w: Math.round(r.width),
      h: Math.round(r.height),
    });
  };
  const h1 = document.querySelector("h1");
  if (h1) push(inView(h1));
  const form = document.querySelector("form");
  if (form) push(inView(form));
  let fieldCount = 0;
  for (const el of Array.from(
    document.querySelectorAll(
      "form input:not([type=hidden]):not([type=submit]):not([type=button]), form textarea"
    )
  )) {
    const r = inView(el);
    if (!r || r.width < 32 || r.height < 14) continue;
    fieldCount += 1;
    push(r);
  }
  let mediaCount = 0;
  for (const el of Array.from(document.querySelectorAll("img, svg"))) {
    const r = inView(el);
    if (!r || r.width < 40 || r.height < 20) continue;
    mediaCount += 1;
    push(r);
  }
  return { fieldCount, mediaCount, boxes };
}

/**
 * True when there is no form, or the form's fields have a real layout
 * (not an unstyled 2-col dump). Self-contained for waitForFunction.
 */
export function pageHasStyledFormLayout(): boolean {
  const forms = Array.from(document.querySelectorAll("form"));
  if (forms.length === 0) return true;
  const vw = window.innerWidth || 1440;
  const vh = window.innerHeight || 900;
  const visibleField = (el: Element): el is HTMLElement => {
    if (!(el instanceof HTMLElement)) return false;
    if (el instanceof HTMLInputElement) {
      const t = el.type.toLowerCase();
      if (
        t === "hidden" ||
        t === "submit" ||
        t === "button" ||
        t === "image" ||
        t === "checkbox" ||
        t === "radio" ||
        t === "file"
      ) {
        return false;
      }
    }
    const st = getComputedStyle(el);
    if (
      st.display === "none" ||
      st.visibility === "hidden" ||
      Number(st.opacity) === 0
    ) {
      return false;
    }
    const r = el.getBoundingClientRect();
    return (
      r.width >= 32 &&
      r.height >= 14 &&
      r.bottom > 0 &&
      r.top < vh &&
      r.right > 0 &&
      r.left < vw
    );
  };

  return forms.some((form) => {
    const fr = form.getBoundingClientRect();
    const fields = Array.from(
      form.querySelectorAll("input, textarea, select")
    ).filter(visibleField);
    if (fields.length < 3) return true;
    if (fr.width < 400) return true;
    const mid = fr.left + fr.width * 0.45;
    const rightish = fields.filter(
      (el) => el.getBoundingClientRect().left > mid
    ).length;
    return rightish < fields.length - 1;
  });
}

export interface InViewImageSignal {
  width: number;
  height: number;
  complete: boolean;
  naturalWidth: number;
}

/** In-view logos/photos must be decoded. 1×1 trackers and tiny icons are ignored. */
export function inViewImagesReady(images: InViewImageSignal[]): boolean {
  for (const img of images) {
    if (img.width < 40 || img.height < 20) continue;
    if (!img.complete || img.naturalWidth <= 20) return false;
  }
  return true;
}

export interface InViewMediaSignal {
  kind: "img" | "svg";
  width: number;
  height: number;
  complete?: boolean;
  naturalWidth?: number;
}

/** In-view img + SVG. 1×1 trackers ignored; a 0×0 SVG is still pending. */
export function inViewMediaReady(media: InViewMediaSignal[]): boolean {
  for (const m of media) {
    if (m.kind === "img") {
      if (m.width < 40 || m.height < 20) continue;
      if (!m.complete || (m.naturalWidth ?? 0) <= 20) return false;
      continue;
    }
    if (m.width < 1 || m.height < 1) return false;
    if (m.width < 40 || m.height < 20) continue;
  }
  return true;
}

export interface LoadingChromeSignal {
  text: string;
  className: string;
  ariaBusy: boolean;
  width: number;
  height: number;
}

/** Large in-viewport spinner / “Loading…” — not an 8px chat dot. */
export function hasVisibleLoadingChrome(nodes: LoadingChromeSignal[]): boolean {
  for (const n of nodes) {
    if (n.width < 80 || n.height < 80) continue;
    const t = n.text.replace(/\s+/g, " ").trim().toLowerCase();
    const cls = n.className.toLowerCase();
    if (n.ariaBusy) return true;
    if (
      /^(loading|loading…|loading\.\.\.|please wait|just a moment)$/i.test(t)
    ) {
      return true;
    }
    if (/\b(loading|spinner|skeleton)\b/.test(cls)) return true;
  }
  return false;
}

/**
 * All viewport-ready signals. Self-contained for waitForFunction — do not
 * call other module functions from here (tsx __name / page serialisation).
 */
export function pageIsCaptureReady(): boolean {
  if (document.readyState !== "complete") return false;

  const vw = window.innerWidth || 1440;
  const vh = window.innerHeight || 900;

  for (const el of Array.from(
    document.querySelectorAll("[aria-busy], [class*='loading' i], [class*='spinner' i], [class*='skeleton' i]")
  )) {
    if (!(el instanceof HTMLElement)) continue;
    const st = getComputedStyle(el);
    if (
      st.display === "none" ||
      st.visibility === "hidden" ||
      Number(st.opacity) === 0
    ) {
      continue;
    }
    const r = el.getBoundingClientRect();
    if (r.width < 80 || r.height < 80) continue;
    if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
    const t = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (el.getAttribute("aria-busy") === "true") return false;
    if (
      t.length > 0 &&
      t.length < 40 &&
      /^(loading|loading…|loading\.\.\.|please wait|just a moment)$/i.test(t)
    ) {
      return false;
    }
    if (/\b(loading|spinner|skeleton)\b/i.test(el.className)) return false;
  }

  for (const img of Array.from(document.images)) {
    const r = img.getBoundingClientRect();
    if (r.width < 40 || r.height < 20) continue;
    if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
    if (img.complete && img.naturalWidth > 20) continue;
    const src = (img.currentSrc || img.src || "").toLowerCase();
    const svgLogo =
      img.complete &&
      (/\.svg(\?|#|$)/.test(src) || src.startsWith("data:image/svg"));
    if (svgLogo) continue;
    if (!img.complete || img.naturalWidth <= 20) return false;
  }
  for (const svg of Array.from(document.querySelectorAll("svg"))) {
    if (!(svg instanceof SVGElement)) continue;
    const st = getComputedStyle(svg);
    if (
      st.display === "none" ||
      st.visibility === "hidden" ||
      Number(st.opacity) === 0
    ) {
      continue;
    }
    const r = svg.getBoundingClientRect();
    if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
    if (r.width < 40 || r.height < 20) continue;
  }

  let overlayCoverage = 0;
  for (const el of Array.from(
    document.querySelectorAll("div, section, aside, dialog, [role=dialog]")
  )) {
    const idc =
      `${el.id} ${el.className} ${el.getAttribute("aria-label") ?? ""}`.toLowerCase();
    const text = (el.textContent || "").slice(0, 200).toLowerCase();
    if (
      !/cookie|consent|onetrust|gdpr|ot-sdk|privacy-banner|cookie-banner/.test(
        idc
      ) &&
      !/we value your privacy|accept default settings/.test(text)
    ) {
      continue;
    }
    const r = el.getBoundingClientRect();
    const w = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
    const h = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    const cov = (w * h) / Math.max(vw * vh, 1);
    if (cov <= 0.92) overlayCoverage = Math.max(overlayCoverage, cov);
  }
  if (overlayCoverage >= 0.35) return false;

  const nearWhite = (color: string): boolean => {
    const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (!m) return false;
    const r = Number(m[1]);
    const g = Number(m[2]);
    const b = Number(m[3]);
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);
    return luma >= 245 && chroma <= 12;
  };
  const painted = (start: Element): boolean => {
    let node: Element | null = start;
    for (let i = 0; i < 6 && node; i++) {
      if (node instanceof HTMLImageElement && node.naturalWidth >= 20) {
        return true;
      }
      if (
        node instanceof HTMLInputElement ||
        node instanceof HTMLTextAreaElement ||
        node instanceof HTMLSelectElement
      ) {
        const box = node.getBoundingClientRect();
        if (box.width >= 24 && box.height >= 16) return true;
      }
      const st = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      const ownText = Array.from(node.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => (n.textContent || "").replace(/\s+/g, " ").trim())
        .join(" ");
      if (
        ownText.length >= 8 &&
        !nearWhite(st.color) &&
        box.height < vh * 0.45 &&
        box.width < vw * 0.92
      ) {
        return true;
      }
      if (st.backgroundImage && st.backgroundImage !== "none") return true;
      node = node.parentElement;
    }
    return false;
  };
  const xs = [0.2, 0.4, 0.5, 0.6, 0.8];
  const ys = [0.22, 0.4, 0.55, 0.7];
  let blank = 0;
  let total = 0;
  for (const y of ys) {
    for (const x of xs) {
      total += 1;
      const el = document.elementFromPoint(vw * x, vh * y);
      if (!el || el === document.documentElement || el === document.body) {
        blank += 1;
        continue;
      }
      if (!painted(el)) blank += 1;
    }
  }
  if (total > 0 && blank / total >= 0.8) return false;

  const cssApplied = (el: Element): boolean => {
    const st = getComputedStyle(el);
    const pad = Number.parseFloat(st.paddingLeft) || 0;
    const radius = Number.parseFloat(st.borderRadius) || 0;
    if (pad >= 10 || radius >= 4) return true;
    const font = (st.fontFamily || "").replace(/["']/g, "").trim().toLowerCase();
    if (!font) return false;
    if (/^(times|times new roman|serif|initial|inherit)(,|$)/.test(font)) {
      return false;
    }
    return true;
  };

  const visibleField = (el: Element): el is HTMLElement => {
    if (!(el instanceof HTMLElement)) return false;
    if (el instanceof HTMLInputElement) {
      const t = el.type.toLowerCase();
      if (
        t === "hidden" ||
        t === "submit" ||
        t === "button" ||
        t === "image" ||
        t === "checkbox" ||
        t === "radio" ||
        t === "file"
      ) {
        return false;
      }
    }
    const st = getComputedStyle(el);
    if (
      st.display === "none" ||
      st.visibility === "hidden" ||
      Number(st.opacity) === 0
    ) {
      return false;
    }
    const r = el.getBoundingClientRect();
    return (
      r.width >= 32 &&
      r.height >= 14 &&
      r.bottom > 0 &&
      r.top < vh &&
      r.right > 0 &&
      r.left < vw
    );
  };

  const forms = Array.from(document.querySelectorAll("form"));
  if (forms.length > 0) {
    return forms.some((form) => {
      const fields = Array.from(
        form.querySelectorAll("input, textarea, select")
      ).filter(visibleField);
      if (fields.length === 0) {
        const iframe = form.querySelector("iframe");
        if (iframe instanceof HTMLElement) {
          const r = iframe.getBoundingClientRect();
          return visibleField(iframe) && r.width >= 200 && r.height >= 80;
        }
        return false;
      }
      return fields.some((el) => cssApplied(el));
    });
  }

  const fallback =
    document.querySelector("h1") ||
    document.querySelector("main a, main button, [role=main] a, [role=main] button");
  if (fallback) return cssApplied(fallback);
  return true;
}

/** Live shot is not usable when most laid-out <img> nodes never decoded. */
export function imagesTooIncomplete(inv: {
  totalImgs: number;
  complete: number;
  visibleImgs?: number;
  visibleComplete?: number;
} | null): boolean {
  if (!inv) return false;
  const total = inv.visibleImgs ?? inv.totalImgs;
  const done = inv.visibleComplete ?? inv.complete;
  if (total < 8) return false;
  return done / total < 0.45;
}

/**
 * Chrome often reports SVG &lt;img&gt; as complete with naturalWidth 0 and
 * then omits them from full-page JPEGs. Inline same-origin / https SVGs so
 * they paint. Self-contained for page.evaluate.
 */
export function inlineZeroNaturalSvgImages(): Promise<number> {
  const jobs: Promise<void>[] = [];
  for (const img of Array.from(document.images)) {
    const src = img.currentSrc || img.src || "";
    const isSvg =
      /\.svg/i.test(src) || src.startsWith("data:image/svg");
    if (!isSvg || img.naturalWidth > 20) continue;
    img.scrollIntoView({ block: "center", inline: "nearest" });
    const box = img.getBoundingClientRect();
    const w = Math.max(
      box.width,
      img.width,
      Number(img.getAttribute("width")) || 0,
      64
    );
    const h = Math.max(
      box.height,
      img.height,
      Number(img.getAttribute("height")) || 0,
      24
    );
    jobs.push(
      (async () => {
        let text = "";
        if (src.startsWith("data:image/svg")) {
          const comma = src.indexOf(",");
          text = comma >= 0 ? decodeURIComponent(src.slice(comma + 1)) : "";
        } else {
          const res = await fetch(src, { credentials: "omit" });
          if (!res.ok) return;
          text = await res.text();
        }
        if (!/<svg/i.test(text)) return;
        const wrap = document.createElement("span");
        wrap.setAttribute("aria-label", img.alt || "logo");
        wrap.style.display = "inline-flex";
        wrap.style.alignItems = "center";
        wrap.style.width = `${Math.min(w, 220)}px`;
        wrap.style.height = `${Math.min(h, 80)}px`;
        wrap.innerHTML = text;
        const svg = wrap.querySelector("svg");
        if (svg) {
          svg.setAttribute("width", "100%");
          svg.setAttribute("height", "100%");
          svg.style.maxWidth = "100%";
          svg.style.maxHeight = "100%";
        }
        img.replaceWith(wrap);
      })().catch(() => {})
    );
  }
  return Promise.all(jobs).then((rows) => rows.length);
}

/** Keep the full-page JPEG at the 1440 desktop width. */
export function lockDesktopShotWidth(width: number): void {
  const w = `${width}px`;
  document.documentElement.style.maxWidth = w;
  document.documentElement.style.overflowX = "hidden";
  document.body.style.maxWidth = w;
  document.body.style.overflowX = "hidden";
}

/** Hide OneTrust banner/PC only — no Accept click, no heuristic overlay scan. */
export function hideKnownConsentSdkInPage(): number {
  let hidden = 0;
  for (const el of Array.from(
    document.querySelectorAll(
      "#onetrust-banner-sdk, #onetrust-pc-sdk, .onetrust-pc-dark-filter, #onetrust-pc-dark-filter"
    )
  )) {
    if (!(el instanceof HTMLElement)) continue;
    el.style.setProperty("display", "none", "important");
    el.style.setProperty("visibility", "hidden", "important");
    el.setAttribute("aria-hidden", "true");
    hidden += 1;
  }
  // Accept normally clears OneTrust's scroll lock. Hiding the banner does not.
  if (hidden > 0) {
    for (const el of [document.documentElement, document.body]) {
      if (!el) continue;
      el.style.setProperty("overflow", "visible", "important");
      el.style.setProperty("overflow-y", "auto", "important");
    }
  }
  return hidden;
}

/** A painted lead form is safer to keep than clicking Accept (page remount). */
export function shouldSkipConsentClick(visibleLeadFields: number): boolean {
  return visibleLeadFields >= 1;
}

export type LeadFieldWaitPhase = "wait" | "ready-form" | "ready-none";

/**
 * Generic settle: no-form pages must not sit on the 8s progressive-form
 * budget. Form pages wait until the field count stops changing (6→2).
 */
export function leadFieldWaitDecision(input: {
  prev: number;
  next: number;
  elapsedMs: number;
  stableMs: number;
  minFormWaitMs?: number;
  noFormStableMs?: number;
  formStableMs?: number;
}): LeadFieldWaitPhase {
  const minFormWaitMs = input.minFormWaitMs ?? 8_000;
  const noFormStableMs = input.noFormStableMs ?? 2_000;
  const formStableMs = input.formStableMs ?? 2_000;
  if (input.next !== input.prev) return "wait";
  if (input.next === 0) {
    return input.stableMs >= noFormStableMs ? "ready-none" : "wait";
  }
  if (input.elapsedMs >= minFormWaitMs && input.stableMs >= formStableMs) {
    return "ready-form";
  }
  return "wait";
}

export function pageFontsReady(): boolean {
  return document.fonts.status === "loaded";
}

/**
 * True when there are no lead fields, or every visible lead field
 * has author padding / radius / a non-UA font.
 */
export function pageLeadFieldsHaveAuthorCss(): boolean {
  const vw = window.innerWidth || 1440;
  const vh = window.innerHeight || 900;
  const fields = Array.from(
    document.querySelectorAll("input, textarea, select")
  ).filter((el): el is HTMLElement => {
    if (!(el instanceof HTMLElement)) return false;
    if (el instanceof HTMLInputElement) {
      const t = el.type.toLowerCase();
      if (
        t === "hidden" ||
        t === "submit" ||
        t === "button" ||
        t === "image" ||
        t === "checkbox" ||
        t === "radio" ||
        t === "file"
      ) {
        return false;
      }
    }
    const st = getComputedStyle(el);
    if (
      st.display === "none" ||
      st.visibility === "hidden" ||
      Number(st.opacity) === 0
    ) {
      return false;
    }
    const r = el.getBoundingClientRect();
    return (
      r.width >= 32 &&
      r.height >= 14 &&
      r.bottom > 0 &&
      r.top < vh &&
      r.right > 0 &&
      r.left < vw
    );
  });
  if (fields.length === 0) return true;
  return fields.every((el) => {
    const st = getComputedStyle(el);
    const pad = Number.parseFloat(st.paddingLeft) || 0;
    const radius = Number.parseFloat(st.borderRadius) || 0;
    if (pad >= 10 || radius >= 4) return true;
    const font = (st.fontFamily || "").replace(/["']/g, "").trim().toLowerCase();
    if (!font) return false;
    if (/^(times|times new roman|serif|initial|inherit)(,|$)/.test(font)) {
      return false;
    }
    return true;
  });
}

/**
 * Footer / below-fold images stay at 0×0 until loading=lazy fires.
 * Promote them to eager and decode so a full-page shot is complete.
 */
export async function eagerDecodeDocumentImages(): Promise<{
  promoted: number;
  decoded: number;
  total: number;
}> {
  const imgs = Array.from(document.images);
  let promoted = 0;
  const jobs = imgs.map(async (img) => {
    if (img.getAttribute("loading") === "lazy") {
      img.loading = "eager";
      promoted += 1;
    }
    const dataSrc =
      img.getAttribute("data-src") ||
      img.getAttribute("data-lazy-src") ||
      img.getAttribute("data-original");
    if (dataSrc && (!img.currentSrc || img.naturalWidth < 2)) {
      img.src = dataSrc;
      promoted += 1;
    }
    try {
      await img.decode();
    } catch {
      /* decode can reject for SVG / already-broken */
    }
    return img.complete && img.naturalWidth > 20;
  });
  const rows = await Promise.all(jobs);
  return {
    promoted,
    decoded: rows.filter(Boolean).length,
    total: imgs.length,
  };
}

export function documentImagesMostlyDecoded(): boolean {
  let need = 0;
  let done = 0;
  for (const img of Array.from(document.images)) {
    const r = img.getBoundingClientRect();
    const lazy = img.getAttribute("loading") === "lazy";
    if (!lazy && r.width < 24 && r.height < 16) continue;
    if (!img.src && !img.currentSrc) continue;
    need += 1;
    const src = (img.currentSrc || img.src || "").toLowerCase();
    const svg =
      /\.svg(\?|#|$)/.test(src) || src.startsWith("data:image/svg");
    if (img.complete && (img.naturalWidth > 20 || svg)) done += 1;
  }
  return need === 0 || done >= need;
}

/** Visible lead inputs. Self-contained for page.evaluate. */
export function countVisibleLeadFields(): number {
  let n = 0;
  for (const el of Array.from(
    document.querySelectorAll("input, textarea, select")
  )) {
    if (!(el instanceof HTMLElement)) continue;
    if (el instanceof HTMLInputElement) {
      const t = el.type.toLowerCase();
      if (
        t === "hidden" ||
        t === "submit" ||
        t === "button" ||
        t === "image" ||
        t === "checkbox" ||
        t === "radio" ||
        t === "file"
      ) {
        continue;
      }
    }
    const st = getComputedStyle(el);
    if (
      st.display === "none" ||
      st.visibility === "hidden" ||
      Number(st.opacity) === 0
    ) {
      continue;
    }
    const r = el.getBoundingClientRect();
    if (r.width >= 32 && r.height >= 14) n += 1;
  }
  return n;
}

/** Count decoded vs still-pending images after the control settle. */
export function collectImageLoadInventory(): {
  totalImgs: number;
  complete: number;
  visibleImgs: number;
  visibleComplete: number;
} {
  let complete = 0;
  let visibleImgs = 0;
  let visibleComplete = 0;
  for (const img of Array.from(document.images)) {
    const src = (img.currentSrc || img.src || "").toLowerCase();
    const svgLogo =
      img.complete &&
      (/\.svg(\?|#|$)/.test(src) || src.startsWith("data:image/svg"));
    const decoded =
      (img.complete && img.naturalWidth > 20) || svgLogo;
    if (decoded) complete += 1;
    const r = img.getBoundingClientRect();
    if (r.width >= 24 || r.height >= 16) {
      visibleImgs += 1;
      if (decoded) visibleComplete += 1;
    }
  }
  return {
    totalImgs: document.images.length,
    complete,
    visibleImgs,
    visibleComplete,
  };
}

/**
 * Hide leftover CMP chrome after Accept (or when the click missed). Visitor
 * view after consent — not a WAF bypass. Self-contained for page.evaluate.
 */
export function hideConsentOverlaysInPage(): number {
  const vw = window.innerWidth || 1440;
  const vh = window.innerHeight || 900;
  let hidden = 0;
  const containsFormOrField = (el: HTMLElement): boolean => {
    if (el.tagName === "FORM") return true;
    return Boolean(
      el.querySelector(
        "form, input[type=email], input[type=text], input[type=tel], textarea"
      )
    );
  };
  const hide = (el: HTMLElement) => {
    if (containsFormOrField(el)) return;
    el.style.setProperty("display", "none", "important");
    el.style.setProperty("visibility", "hidden", "important");
    el.setAttribute("aria-hidden", "true");
    hidden += 1;
  };

  // Banner / preference UI only — not #onetrust-consent-sdk (can wrap the page).
  for (const el of Array.from(
    document.querySelectorAll(
      "#onetrust-banner-sdk, #onetrust-pc-sdk, .onetrust-pc-dark-filter, #onetrust-pc-dark-filter"
    )
  )) {
    if (el instanceof HTMLElement) hide(el);
  }

  for (const el of Array.from(
    document.querySelectorAll("div, section, aside, dialog, [role=dialog]")
  )) {
    if (!(el instanceof HTMLElement)) continue;
    if (el.style.display === "none") continue;
    const idc =
      `${el.id} ${el.className} ${el.getAttribute("aria-label") ?? ""}`.toLowerCase();
    const text = (el.textContent || "").slice(0, 280).toLowerCase();
    const r = el.getBoundingClientRect();
    const w = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
    const h = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    const coverage = (w * h) / Math.max(vw * vh, 1);
    const looksConsent =
      /cookie|consent|onetrust|gdpr|ot-sdk|privacy-banner|cookie-banner/.test(
        idc
      ) ||
      /we value your privacy|cookie settings|accept default settings|accept recommended|manage (cookie|choices)/.test(
        text
      );
    if (!looksConsent) continue;
    if (/main|article/.test(idc) && !/cookie|consent|onetrust/.test(idc)) {
      continue;
    }
    if (coverage < 0.12 || coverage > 0.92) continue;
    if (containsFormOrField(el)) continue;
    hide(el);
  }
  return hidden;
}

export function assessCaptureQuality(input: {
  signals: CaptureSignals;
  hasFormLandmark: boolean;
  copyText: string;
  dismissedConsent?: boolean;
}): CaptureQuality {
  const notes: string[] = [];
  let incomplete = false;
  const sellsForm = copySellsLeadForm(input.copyText);
  const collapsed = input.signals.formIframes.some(
    (f) => f.width >= 80 && f.height < 40
  );
  const emptySlot = input.signals.slots.some(
    (s) =>
      s.width >= input.signals.viewportWidth * 0.25 &&
      s.height >= 200 &&
      s.textLength <= 80
  );

  if (collapsed) {
    incomplete = true;
    notes.push(
      "A form embed was present but had not finished loading (collapsed iframe)."
    );
  }
  if (emptySlot && (sellsForm || !input.hasFormLandmark)) {
    incomplete = true;
    notes.push(
      "Part of the page had not loaded when we captured it — often the hero form. Do not treat empty space as a missing form."
    );
  }
  if (
    !incomplete &&
    !input.hasFormLandmark &&
    !input.signals.hasFormControl &&
    sellsForm
  ) {
    incomplete = true;
    notes.push(
      "The copy sells a demo or lead form, but no form was visible in the capture."
    );
  }
  if (input.dismissedConsent && incomplete) {
    notes.push("Cookie consent was dismissed so we could see the page.");
  }

  return {
    incompleteCapture: incomplete,
    captureNote: notes.length > 0 ? notes.join(" ") : null,
  };
}

/**
 * Merge screenshot flags onto page context. Hard blocks win; incomplete is
 * only set on a real (unblocked) page.
 */
export function applyCaptureOutcome(
  ctx: PageContext,
  shot: ScreenshotCaptureFlags
): PageContext {
  if (ctx.blocked) {
    return {
      ...ctx,
      incompleteCapture: undefined,
      captureNote: null,
      liveTest: undefined,
    };
  }
  if (shot.blockedReason) {
    return {
      ...ctx,
      blocked: true,
      blockReason: shot.blockedReason,
      incompleteCapture: undefined,
      captureNote: null,
      liveTest: undefined,
    };
  }
  if (!shot.incompleteCapture && !shot.captureNote && !shot.liveTest) return ctx;
  return {
    ...ctx,
    incompleteCapture: shot.incompleteCapture || undefined,
    captureNote: shot.captureNote,
    liveTest: shot.liveTest ?? undefined,
  };
}
