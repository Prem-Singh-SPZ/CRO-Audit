/**
 * Sanitizes untrusted text (scraped page copy, user-supplied audit context,
 * LLM-derived issue text) before it is embedded into another model's prompt.
 *
 * This does NOT try to "detect" every jailbreak — that is unreliable. Instead
 * it (1) strips control/zero-width characters that hide instructions, (2)
 * collapses runaway whitespace/repetition that can be used to blow the context
 * or bury a payload, and (3) hard-caps the length. Callers should additionally
 * wrap the result in a clearly-labelled "untrusted data" block and instruct the
 * model to never follow instructions found inside it.
 */
export function sanitizeUntrustedText(input: string, maxLen = 6000): string {
  if (!input) return "";
  let s = input;

  // Drop zero-width + bidi control chars often used to smuggle instructions.
  s = s.replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g, "");
  // Drop other C0/C1 control chars except tab/newline.
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, " ");
  // Collapse excessive whitespace/newlines.
  s = s.replace(/[ \t]{3,}/g, "  ").replace(/\n{3,}/g, "\n\n");
  // Collapse absurd single-character repetition (e.g. 5000 "!" to break parsing).
  s = s.replace(/(.)\1{40,}/g, "$1$1$1");

  s = s.trim();
  if (s.length > maxLen) s = `${s.slice(0, maxLen - 1)}\u2026`;
  return s;
}
