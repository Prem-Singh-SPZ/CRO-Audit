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
 * Reads the lead form from the rendered document. Self-contained so Puppeteer
 * can run it in the page. Returns only labels that exist on the controls —
 * never a guessed field list.
 *
 * A field the visitor cannot see is not part of the closed list. That includes
 * type=hidden, the hidden attribute, aria-hidden, a zero-size box, a control
 * parked off the form, and a field row or later multi-step step whose own
 * layout is display:none / visibility:hidden. The above-the-fold mockup should
 * show the step that is actually on screen. A form that is merely covered by
 * an overlay still counts: its controls keep a real box, and the walk stops
 * at the form element itself.
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

  // Tracking inputs (HubSpot URL / utm_*) are often type=text inside a field
  // row that is not shown. Skip those. Do not walk into the form element
  // itself: a form covered by an overlay still has real boxes.
  const isNotVisibleControl = (el: Element): boolean => {
    if (el.hasAttribute("hidden") || el.getAttribute("aria-hidden") === "true") {
      return true;
    }
    const styledHidden = (node: Element): boolean => {
      const st = getComputedStyle(node);
      return (
        st.display === "none" ||
        st.visibility === "hidden" ||
        st.visibility === "collapse"
      );
    };
    if (styledHidden(el)) return true;
    const form = el.closest("form");
    let node = el.parentElement;
    while (node && node !== form) {
      if (styledHidden(node)) return true;
      node = node.parentElement;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return true;
    // left:-9999px and similar. A field that simply continues below the
    // form is still a real control.
    const bounds = (form ?? document.body).getBoundingClientRect();
    if (
      rect.right < bounds.left - 8 ||
      rect.left > bounds.right + 8 ||
      rect.bottom < bounds.top - 8
    ) {
      return true;
    }
    return false;
  };

  const isRadio = (el: Element): boolean =>
    el.tagName.toLowerCase() === "input" &&
    (el.getAttribute("type") || "").toLowerCase() === "radio";

  // A radio set is one question ("Are you a current customer?"), not one
  // input per option. Label it from the fieldset legend / radiogroup label.
  const radioGroupLabel = (el: Element): string | null => {
    const legend = el.closest("fieldset")?.querySelector("legend");
    if (legend?.textContent?.trim()) return clean(legend.textContent);
    const group = el.closest("[role='radiogroup'], [role='group']");
    if (group) {
      const aria = group.getAttribute("aria-label");
      if (aria && aria.trim()) return clean(aria);
      const by = group.getAttribute("aria-labelledby");
      if (by) {
        const text = by
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? "")
          .join(" ");
        if (text.trim()) return clean(text);
      }
    }
    // HubSpot / Marketo put the question in a plain label above the options.
    // Climb to the container that holds the whole radio set and take the
    // last text-only label/heading that precedes the first option.
    let node: Element | null = el.parentElement;
    for (let i = 0; i < 5 && node; i++) {
      const radios = node.querySelectorAll("input[type='radio']");
      if (radios.length >= 2 && radios[0]) {
        const first = radios[0];
        const before = Array.from(
          node.querySelectorAll("label, legend, p, span, div, h1, h2, h3, h4, h5, h6")
        ).filter((c) => {
          if (c.querySelector("input, select, textarea, button")) return false;
          if (c.closest("label")?.querySelector("input")) return false;
          const t = (c.textContent || "").replace(/\s+/g, " ").trim();
          if (t.length < 3 || t.length > 120) return false;
          return Boolean(
            c.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING
          );
        });
        const pick = before[before.length - 1];
        if (pick?.textContent?.trim()) return clean(pick.textContent);
      }
      node = node.parentElement;
    }
    return null;
  };

  const isBoxControl = (el: Element): boolean => {
    const tag = el.tagName.toLowerCase();
    if (tag === "select" || tag === "textarea") return true;
    const type = (el.getAttribute("type") || "text").toLowerCase();
    return type !== "radio" && type !== "checkbox";
  };

  const labelOf = (el: Element): string => {
    if (isRadio(el)) {
      const group = radioGroupLabel(el);
      if (group) return group;
    }
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

  const controlsOf = (root: ParentNode): Element[] => {
    const seenRadioGroups = new Set<string>();
    return Array.from(root.querySelectorAll("input, textarea, select")).filter(
      (el) => {
        if (isSkippable(el) || isNotVisibleControl(el) || looksLikeSearch(el)) return false;
        if (isRadio(el)) {
          const key = el.getAttribute("name") || "";
          if (key) {
            if (seenRadioGroups.has(key)) return false;
            seenRadioGroups.add(key);
          }
        }
        return true;
      }
    );
  };

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
    const controls = controlsOf(best).slice(0, 16);
    const fields = controls.map(labelOf).filter(Boolean);
    const boxFieldCount = controls.filter(isBoxControl).length;
    const submit = best.querySelector(
      "button, input[type='submit'], [type='submit']"
    );
    const submitRaw =
      submit?.textContent || submit?.getAttribute("value") || "";
    const submitLabel = submitRaw.trim() ? clean(submitRaw) : null;
    if (fields.length > 0 || submitLabel) {
      return {
        present: true,
        source: "fields",
        fields,
        boxFieldCount,
        submitLabel,
      };
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
