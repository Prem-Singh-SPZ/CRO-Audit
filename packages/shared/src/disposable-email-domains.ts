// ---------------------------------------------------------------------------
// Disposable / temporary email domain blocklist
// ---------------------------------------------------------------------------
// The OTP flow already proves a mailbox is reachable, but disposable inbox
// services (mailinator, 10minutemail, temp-mail, ...) still receive mail, so a
// throwaway address can pass verification. This curated list rejects the most
// common ones up front so the report gate captures usable leads. It is not
// exhaustive (new domains appear constantly) — it targets the high-volume
// providers that account for the bulk of throwaway signups.
// ---------------------------------------------------------------------------

export const DISPOSABLE_EMAIL_DOMAINS: ReadonlySet<string> = new Set([
  // mailinator + known aliases
  "mailinator.com",
  "mailinator.net",
  "mailinator2.com",
  "reallymymail.com",
  "sogetthis.com",
  "spamherelots.com",
  "notmailinator.com",
  "binkmail.com",
  "bobmail.info",
  "chammy.info",
  "devnullmail.com",
  "letthemeatspam.com",
  "mailin8r.com",
  "mailnesia.com",
  "mailnull.com",
  "spam4.me",
  "thisisnotmyrealemail.com",
  "tradermail.info",
  "veryrealemail.com",
  // 10minutemail family
  "10minutemail.com",
  "10minutemail.net",
  "10minutemail.org",
  "10minemail.com",
  "20minutemail.com",
  "temp-mail.org",
  "temp-mail.io",
  "tempmail.com",
  "tempmail.net",
  "tempmailo.com",
  "tempr.email",
  "tempmailaddress.com",
  "tempinbox.com",
  "tempemail.co",
  "tempemail.net",
  "throwawaymail.com",
  "throwam.com",
  "getnada.com",
  "nada.email",
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "guerrillamail.biz",
  "guerrillamail.de",
  "guerrillamailblock.com",
  "sharklasers.com",
  "grr.la",
  "pokemail.net",
  "spam.me",
  // yopmail family
  "yopmail.com",
  "yopmail.net",
  "yopmail.fr",
  "cool.fr.nf",
  "jetable.fr.nf",
  "nospam.ze.tc",
  "nomail.xl.cx",
  "mega.zik.dj",
  "speed.1s.fr",
  "courriel.fr.nf",
  "moncourrier.fr.nf",
  "monemail.fr.nf",
  "monmail.fr.nf",
  // dispostable / trashmail / others
  "dispostable.com",
  "trashmail.com",
  "trashmail.net",
  "trashmail.io",
  "trash-mail.com",
  "trashmail.de",
  "kurzepost.de",
  "objectmail.com",
  "proxymail.eu",
  "rcpt.at",
  "wegwerfmail.de",
  "wegwerfmail.net",
  "wegwerfmail.org",
  "fakeinbox.com",
  "fakemailgenerator.com",
  "fakemail.net",
  "emailondeck.com",
  "emailfake.com",
  "email-fake.com",
  "mailcatch.com",
  "maildrop.cc",
  "mailexpire.com",
  "mailtemp.info",
  "mailtothis.com",
  "mohmal.com",
  "mytemp.email",
  "mt2015.com",
  "mytrashmail.com",
  "spambog.com",
  "spambox.us",
  "spamgourmet.com",
  "discard.email",
  "discardmail.com",
  "discardmail.de",
  "getairmail.com",
  "harakirimail.com",
  "incognitomail.org",
  "inboxbear.com",
  "inboxkitten.com",
  "jetable.org",
  "mailexpire.com",
  "mailhz.me",
  "mailmetrash.com",
  "mailquack.com",
  "mailsac.com",
  "meltmail.com",
  "mintemail.com",
  "no-spam.ws",
  "nowmymail.com",
  "spamfree24.org",
  "tmail.ws",
  "tmpmail.net",
  "tmpmail.org",
  "vomoto.com",
  "yepmail.cc",
  "zetmail.com",
  "0wnd.net",
  "1secmail.com",
  "1secmail.net",
  "1secmail.org",
  "33mail.com",
  "byom.de",
  "burnermail.io",
  "einrot.com",
  "fleckens.hu",
  "gustr.com",
  "jourrapide.com",
  "rhyta.com",
  "superrito.com",
  "teleworm.us",
  "armyspy.com",
  "cuvox.de",
  "dayrep.com",
]);

/** Returns the lowercased domain portion of an email, or null if malformed. */
export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return null;
  return email.slice(at + 1).trim().toLowerCase();
}

/**
 * True when the email's domain (or any parent domain, to catch subdomains like
 * `foo.mailinator.com`) is a known disposable/temporary inbox provider.
 */
export function isDisposableEmail(email: string): boolean {
  const domain = emailDomain(email);
  if (!domain) return false;

  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) return true;

  // Catch subdomains of blocked providers (e.g. inbox.mailinator.com) by
  // walking up the label chain.
  const parts = domain.split(".");
  for (let i = 1; i < parts.length - 1; i++) {
    if (DISPOSABLE_EMAIL_DOMAINS.has(parts.slice(i).join("."))) return true;
  }

  return false;
}
