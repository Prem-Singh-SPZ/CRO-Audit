import type { LeadFormSignal } from "@cro/shared";

export function emptyLeadForm(): LeadFormSignal {
  return { present: false, source: null, fields: [], submitLabel: null };
}

/**
 * Reads the lead form from the rendered document, including fields that are
 * covered or not painted. Self-contained so Puppeteer can run it in the page.
 * Returns only labels that exist on the controls — never a guessed field list.
 */
export function readLeadFormInPage(): LeadFormSignal {
  const clean = (raw: string): string =>
    raw.replace(/\s+/g, " ").trim().slice(0, 80);

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
    if (controls.length === 0) continue;
    const inChrome = Boolean(form.closest("header, nav, [role='search']"));
    if (inChrome && controls.length === 1 && looksLikeSearch(controls[0])) continue;
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
