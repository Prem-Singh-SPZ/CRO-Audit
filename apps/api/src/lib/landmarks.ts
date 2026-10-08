import type { Page } from "puppeteer-core";
import {
  LANDMARK_IDS,
  type IssueInput,
  type LandmarkBox,
  type LandmarkId,
  type ReportJson,
} from "@cro/shared";

export function inferLandmarkId(text: string): LandmarkId | null {
  const t = text.toLowerCase();
  // Navigation before CTA so "Navigation CTA" stays on the nav, not the
  // form button. "Hero CTAs" must not land on the hero section, and
  // "Benefit Copy (Below Form)" must not land on the headline.
  if (/\b(nav|menu|navigation)\b/.test(t)) return "nav";
  if (/\b(ctas?|buttons?|submits?)\b/.test(t)) return "cta";
  if (/\b(headlines?|\bh1\b|subheads?)\b/.test(t)) return "h1";
  if (
    /\b(forms?|emails?|fields?|sign-?ups?)\b/.test(t) &&
    !/\b(below|above|near|under|beside|next to)\b/.test(t)
  ) {
    return "form";
  }
  if (/\b(testimonials?|reviews?)\b/.test(t)) return "testimonials";
  if (/\bfooter\b/.test(t)) return "footer";
  if (/\bpric(e|ing)\b/.test(t)) return "pricing";
  return null;
}

export function landmarkById(
  landmarks: LandmarkBox[],
  id: LandmarkId
): LandmarkBox | undefined {
  return landmarks.find((l) => l.id === id);
}

export function applyLandmarkPins(
  report: ReportJson,
  landmarks: LandmarkBox[]
): ReportJson {
  return {
    ...report,
    issues: report.issues.map((issue) => {
      const fromAnn = issue.annotation;
      const explicit =
        fromAnn?.element && fromAnn.element !== "hero"
          ? landmarkById(landmarks, fromAnn.element)
          : undefined;
      const guessed = inferLandmarkId(issue.title);
      const named =
        explicit || (guessed ? landmarkById(landmarks, guessed) : undefined);
      // The hero landmark is the whole section. A model x/y with no measured
      // element is a guess — drop it so the report does not draw a pill there.
      if (!named || named.id === "hero") {
        return { ...issue, annotation: null };
      }
      return {
        ...issue,
        annotation: {
          device: "desktop",
          x: named.x,
          y: named.y,
          width: named.width,
          height: named.height,
          element: named.id,
        },
      };
    }),
  };
}

/** One viewport. Extra screens add annotations, capped by measured landmarks. */
const VIEWPORT_HEIGHT = 900;

const PIN_PRIORITY: LandmarkId[] = [
  "h1",
  "cta",
  "form",
  "testimonials",
  "pricing",
  "nav",
  "footer",
];

/**
 * How many distinct on-page pills a screenshot should show.
 * A single screen gets 2, a second screen gets 3, and taller pages add more.
 */
export function annotationTarget(pageHeight: number): number {
  const screens = Math.max(1, pageHeight / VIEWPORT_HEIGHT);
  if (screens < 1.4) return 2;
  if (screens < 2.4) return 3;
  return Math.min(PIN_PRIORITY.length, Math.round(screens + 2));
}

function pinnedElement(issue: IssueInput): LandmarkId | null {
  const id = issue.annotation?.element;
  if (!id || id === "hero") return null;
  return id;
}

function landmarkIssue(landmark: LandmarkBox): IssueInput {
  const quoted = landmark.text.replace(/\s+/g, " ").trim().slice(0, 140);
  return {
    category: landmark.label,
    title: landmark.label,
    description: quoted
      ? `Visible on the page: "${quoted}".`
      : `${landmark.label} is visible on this page.`,
    whyItMatters: "Visitors make a decision at this element.",
    psychology: "Visitors make a decision at this element.",
    severity: "INFO",
    confidence: 60,
    businessImpact: "",
    suggestedFix: "Requires custom UX/copywriting redesign.",
    estimatedConversionImpact: "n/a",
    annotation: {
      device: "desktop",
      x: landmark.x,
      y: landmark.y,
      width: landmark.width,
      height: landmark.height,
      element: landmark.id,
    },
  };
}

/**
 * Fill out the screenshot until it has the page-length minimum, using only
 * Chromium landmarks that are not already pinned. Never invents a coordinate.
 * The hero box is skipped — it covers the whole section.
 */
export function ensureAnnotationCoverage(
  report: ReportJson,
  landmarks: LandmarkBox[],
  pageHeight: number
): ReportJson {
  if (pageHeight <= 0 || landmarks.length === 0) return report;
  const usable = landmarks.filter((l) => l.id !== "hero");
  const used = new Set(
    report.issues.map(pinnedElement).filter((id): id is LandmarkId => id != null)
  );
  const target = Math.min(annotationTarget(pageHeight), usable.length);
  if (used.size >= target) return report;

  const unused = usable
    .filter((l) => !used.has(l.id))
    .sort((a, b) => {
      const rank = (id: LandmarkId) => {
        const i = PIN_PRIORITY.indexOf(id);
        return i === -1 ? PIN_PRIORITY.length : i;
      };
      return rank(a.id) - rank(b.id) || a.y - b.y;
    });

  const added: IssueInput[] = [];
  for (const landmark of unused) {
    if (used.size + added.length >= target) break;
    added.push(landmarkIssue(landmark));
  }
  if (added.length === 0) return report;
  return { ...report, issues: [...report.issues, ...added] };
}

/**
 * Reads H1 / CTA / form / nav / footer (and a few section hooks) from the
 * rendered page and returns 0–1 boxes on the stitch. Self-contained so it
 * can run inside page.evaluate.
 */
export async function measureLandmarks(
  page: Page,
  pageWidth: number,
  pageHeight: number,
  timeoutMs: number
): Promise<LandmarkBox[]> {
  try {
    const result = await Promise.race([
      page.evaluate(measureInPage, pageWidth, pageHeight),
      new Promise<LandmarkBox[]>((resolve) =>
        setTimeout(() => resolve([]), timeoutMs)
      ),
    ]);
    return Array.isArray(result) ? result.filter(isLandmark) : [];
  } catch {
    return [];
  }
}

function isLandmark(v: unknown): v is LandmarkBox {
  if (!v || typeof v !== "object") return false;
  const o = v as LandmarkBox;
  return (
    (LANDMARK_IDS as readonly string[]).includes(o.id) &&
    typeof o.x === "number" &&
    typeof o.y === "number"
  );
}

function measureInPage(pageWidth: number, pageHeight: number): LandmarkBox[] {
  const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
  const visible = (el: Element | null): el is HTMLElement => {
    if (!el || !(el instanceof HTMLElement)) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 8 && r.height >= 8;
  };
  const contentRect = (el: HTMLElement) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const rects = Array.from(range.getClientRects()).filter(
      (r) => r.width >= 8 && r.height >= 8
    );
    if (rects.length === 0) return el.getBoundingClientRect();
    const top = Math.min(...rects.map((r) => r.top));
    const left = Math.min(...rects.map((r) => r.left));
    const right = Math.max(...rects.map((r) => r.right));
    const bottom = Math.max(...rects.map((r) => r.bottom));
    return {
      top,
      left,
      width: right - left,
      height: bottom - top,
    };
  };
  const box = (
    el: HTMLElement,
    id: LandmarkBox["id"],
    label: string,
    tight = false
  ): LandmarkBox | null => {
    const r = tight ? contentRect(el) : el.getBoundingClientRect();
    const top = r.top + window.scrollY;
    const left = r.left + window.scrollX;
    if (top > pageHeight || left > pageWidth) return null;
    const w = Math.min(r.width, pageWidth);
    const h = Math.min(r.height, pageHeight);
    const text = (el.innerText || el.getAttribute("aria-label") || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);
    return {
      id,
      label,
      text,
      x: clamp01((left + w / 2) / Math.max(pageWidth, 1)),
      y: clamp01((top + h / 2) / Math.max(pageHeight, 1)),
      width: clamp01(w / Math.max(pageWidth, 1)),
      height: clamp01(h / Math.max(pageHeight, 1)),
    };
  };
  const first = (selectors: string[]): HTMLElement | null => {
    for (const sel of selectors) {
      const found = Array.from(document.querySelectorAll(sel)).find(visible);
      if (found) return found;
    }
    return null;
  };

  const out: LandmarkBox[] = [];
  const push = (
    el: HTMLElement | null,
    id: LandmarkBox["id"],
    label: string,
    tight = false
  ) => {
    if (!el) return;
    const b = box(el, id, label, tight);
    if (b) out.push(b);
  };

  push(first(["h1"]), "h1", "Primary headline", true);
  push(
    first(["header nav", "nav", "header", "[role=navigation]"]),
    "nav",
    "Navigation"
  );
  let formEl = first(["form"]);
  if (!formEl) {
    const field = first(["input[type=email]", "input[type=submit]"]);
    const parent = field?.closest("form");
    formEl = parent instanceof HTMLElement ? parent : field;
  }
  push(formEl, "form", "Primary form");
  // Header/nav buttons (the "Demo" link) are not the page CTA. Prefer the
  // form submit, then any other in-content control. If neither exists, leave
  // cta unset so a Bottom CTA finding is not pinned to the nav.
  const inChrome = (el: Element) =>
    Boolean(el.closest("header, nav, [role=navigation]"));
  const isContentCta = (el: Element): el is HTMLElement => {
    if (!(el instanceof HTMLElement) || !visible(el) || inChrome(el)) return false;
    const text = (
      el.innerText ||
      (el instanceof HTMLInputElement ? el.value : "") ||
      el.getAttribute("aria-label") ||
      ""
    )
      .replace(/\s+/g, " ")
      .trim();
    if (text.length < 2 || text.length > 48) return false;
    const r = el.getBoundingClientRect();
    return r.height >= 16 && r.height <= 88 && r.width >= 48 && r.width <= 480;
  };
  const formSubmit =
    formEl && !inChrome(formEl)
      ? Array.from(
          formEl.querySelectorAll(
            "button[type=submit], input[type=submit], button"
          )
        ).find(isContentCta) ?? null
      : null;
  const cta =
    formSubmit ??
    Array.from(
      document.querySelectorAll(
        "a[class*=cta i], button[class*=cta i], a[class*=primary i], button[type=submit], form button, a[class*=button i]"
      )
    ).find(isContentCta) ??
    null;
  push(cta, "cta", "Primary call to action", true);
  push(
    first(["footer", "[role=contentinfo]"]),
    "footer",
    "Footer"
  );
  push(
    first(["main > section", "main > div", "[class*=hero i]", "header + *"]),
    "hero",
    "Hero / above the fold"
  );
  push(
    first([
      "[class*=testimonial i]",
      "[class*=review i]",
      "[class*=social-proof i]",
    ]),
    "testimonials",
    "Social proof"
  );
  push(
    first(["[class*=pric i]", "[id*=pric i]"]),
    "pricing",
    "Pricing"
  );
  return out;
}
