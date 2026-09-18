import type { Page } from "puppeteer-core";
import {
  LANDMARK_IDS,
  type LandmarkBox,
  type LandmarkId,
  type ReportJson,
} from "@cro/shared";

const KIND_HINT: Record<string, LandmarkId> = {
  headline: "h1",
  h1: "h1",
  title: "h1",
  subhead: "h1",
  "value prop": "h1",
  messaging: "h1",
  copy: "h1",
  hero: "hero",
  cta: "cta",
  button: "cta",
  submit: "cta",
  form: "form",
  email: "form",
  field: "form",
  capture: "form",
  nav: "nav",
  menu: "nav",
  header: "nav",
  footer: "footer",
  testimonial: "testimonials",
  review: "testimonials",
  social: "testimonials",
  proof: "testimonials",
  pric: "pricing",
};

export function inferLandmarkId(text: string): LandmarkId | null {
  const t = text.toLowerCase();
  for (const [hint, id] of Object.entries(KIND_HINT)) {
    if (t.includes(hint)) return id;
  }
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
  if (landmarks.length === 0) return report;
  return {
    ...report,
    issues: report.issues.map((issue) => {
      const fromAnn = issue.annotation;
      const named =
        (fromAnn?.element && landmarkById(landmarks, fromAnn.element)) ||
        (() => {
          const guessed = inferLandmarkId(
            `${issue.title} ${issue.category} ${issue.description}`
          );
          return guessed ? landmarkById(landmarks, guessed) : undefined;
        })();
      if (!named) return issue;
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
  const box = (
    el: HTMLElement,
    id: LandmarkBox["id"],
    label: string
  ): LandmarkBox | null => {
    const r = el.getBoundingClientRect();
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
  const push = (el: HTMLElement | null, id: LandmarkBox["id"], label: string) => {
    if (!el) return;
    const b = box(el, id, label);
    if (b) out.push(b);
  };

  push(first(["h1"]), "h1", "Primary headline");
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
  push(
    first([
      "a[class*=cta i]",
      "button[class*=cta i]",
      "a[class*=primary i]",
      "button[type=submit]",
      "form button",
      "header a[href]",
    ]),
    "cta",
    "Primary call to action"
  );
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
