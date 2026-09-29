import type { LeadFormSignal } from "@cro/shared";

export function emptyLeadForm(): LeadFormSignal {
  return { present: false, source: null, fields: [], submitLabel: null };
}

/**
 * Minimum visible inputs for a `<form>` to count as a lead form. Anything
 * smaller (newsletter email box, footer signup, coupon field) is page
 * furniture, not the conversion goal — the page is then treated as a
 * landing / pricing / marketing page and gets the hero pattern instead.
 *
 * Keep in sync with the literal inside `readLeadFormInPage` (that function is
 * serialized into the browser and cannot reference module constants).
 */
export const MIN_LEAD_FORM_FIELDS = 3;

/**
 * True when the measured signal is a form worth redesigning: a readable form
 * with at least MIN_LEAD_FORM_FIELDS inputs, or a known form-vendor iframe
 * (HubSpot, Marketo, …) whose fields we cannot count from outside.
 */
export function isQualifyingLeadForm(
  leadForm?: LeadFormSignal | null
): boolean {
  if (!leadForm?.present) return false;
  if (leadForm.source === "iframe") return true;
  return leadForm.fields.length >= MIN_LEAD_FORM_FIELDS;
}

/**
 * Reads the lead form from the rendered document, including fields that are
 * covered or not painted. Self-contained so Puppeteer can run it in the page.
 * Returns only labels that exist on the controls — never a guessed field list.
 *
 * Ignores footer / newsletter forms and any form with fewer than three inputs,
 * so a pricing page with a "Subscribe" email box is not treated as form-first.
 */
export function readLeadFormInPage(): LeadFormSignal {
  // Mirrors MIN_LEAD_FORM_FIELDS; this function runs inside the page.
  const MIN_FIELDS = 3;

  const clean = (raw: string): string =>
    raw.replace(/\s+/g, " ").trim().slice(0, 80);

  const inFooter = (el: Element): boolean =>
    Boolean(el.closest("footer, [role='contentinfo']"));

  // Newsletter / subscribe widgets are not lead-gen forms even when they sit
  // above the footer. Look at the form's own attributes plus its visible text.
  const looksLikeNewsletter = (form: Element): boolean => {
    const attrs = [
      form.getAttribute("id"),
      form.getAttribute("name"),
      form.getAttribute("class"),
      form.getAttribute("action"),
      form.getAttribute("aria-label"),
      form.getAttribute("data-form-type"),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const text = (form.textContent || "").replace(/\s+/g, " ").toLowerCase();
    const re = /newsletter|subscribe|subscription|stay (up to date|in the loop|informed)|get (the latest|updates)|join our (list|mailing)/;
    return re.test(attrs) || re.test(text.slice(0, 400));
  };

  const blobOf = (el: Element): string =>
    [
      el.getAttribute("type"),
      el.getAttribute("name"),
      el.getAttribute("id"),
      el.getAttribute("placeholder"),
      el.getAttribute("aria-label"),
      el.getAttribute("autocomplete"),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

  const looksLikeSearch = (el: Element): boolean => {
    const blob = blobOf(el);
    return /\b(search|query)\b/.test(blob) && !/email|e-mail|phone|company/.test(blob);
  };

  const isSkippable = (el: Element): boolean => {
    const tag = el.tagName.toLowerCase();
    if (tag !== "input" && tag !== "textarea" && tag !== "select") return true;
    const type = (el.getAttribute("type") || (tag === "input" ? "text" : tag)).toLowerCase();
    return [
      "hidden",
      "submit",
      "button",
      "image",
      "reset",
      "file",
      "range",
      "color",
    ].includes(type);
  };

  const labelOf = (el: Element): string => {
    const aria = el.getAttribute("aria-label");
    if (aria && aria.trim()) return clean(aria);
    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      const text = labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent ?? "")
        .join(" ");
      if (text.trim()) return clean(text);
    }
    const id = el.getAttribute("id");
    if (id && typeof CSS !== "undefined" && CSS.escape) {
      const lab = document.querySelector(`label[for="${CSS.escape(id)}"]`);
      if (lab?.textContent?.trim()) return clean(lab.textContent);
    }
    const wrap = el.closest("label");
    if (wrap) {
      const clone = wrap.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("input, select, textarea").forEach((n) => n.remove());
      if (clone.textContent?.trim()) return clean(clone.textContent);
    }
    const placeholder = el.getAttribute("placeholder");
    if (placeholder && placeholder.trim()) return clean(placeholder);
    const name = el.getAttribute("name");
    if (name && name.trim()) return clean(name.replace(/[_[\]]+/g, " "));
    const type = (el.getAttribute("type") || el.tagName || "input").toLowerCase();
    return clean(type);
  };

  const controlsOf = (root: ParentNode): Element[] =>
    Array.from(root.querySelectorAll("input, textarea, select")).filter(
      (el) => !isSkippable(el) && !looksLikeSearch(el)
    );

  const forms = Array.from(document.querySelectorAll("form"));
  let best: Element | null = null;
  let bestCount = 0;
  for (const form of forms) {
    const controls = controlsOf(form);
    // A lead form has several inputs. One or two boxes is a newsletter,
    // login, coupon, or search widget — never the page's conversion goal.
    if (controls.length < MIN_FIELDS) continue;
    if (form.closest("nav, [role='search']")) continue;
    if (inFooter(form)) continue;
    if (looksLikeNewsletter(form)) continue;
    if (controls.length > bestCount) {
      best = form;
      bestCount = controls.length;
    }
  }

  if (best) {
    const fields = controlsOf(best)
      .map(labelOf)
      .filter(Boolean)
      .slice(0, 16);
    const submit = best.querySelector(
      "button, input[type='submit'], [type='submit']"
    );
    const submitRaw =
      submit?.textContent || submit?.getAttribute("value") || "";
    const submitLabel = submitRaw.trim() ? clean(submitRaw) : null;
    if (fields.length > 0 || submitLabel) {
      return { present: true, source: "fields", fields, submitLabel };
    }
  }

  const iframe = Array.from(document.querySelectorAll("iframe")).find((frame) => {
    const label = `${frame.getAttribute("src") ?? ""} ${frame.getAttribute("title") ?? ""} ${frame.id} ${frame.className}`;
    if (!/hsforms|hubspot|marketo|pardot|typeform|calendly|chilipiper|\bform\b/i.test(label)) {
      return false;
    }
    // A footer-embedded signup widget is not the page's conversion goal.
    if (inFooter(frame)) return false;
    const r = frame.getBoundingClientRect();
    return r.width >= 80 && r.height >= 40;
  });
  if (iframe) {
    return { present: true, source: "iframe", fields: [], submitLabel: null };
  }

  return { present: false, source: null, fields: [], submitLabel: null };
}

/** Keep the signal that actually lists fields. A later empty read must not erase it. */
export function preferLeadForm(
  current: LeadFormSignal,
  next: LeadFormSignal
): LeadFormSignal {
  const score = (s: LeadFormSignal) =>
    s.present ? (s.fields.length > 0 ? 2 : 1) : 0;
  return score(next) > score(current) ? next : current;
}
