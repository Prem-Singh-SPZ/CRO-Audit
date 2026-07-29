import { promises as dns } from "node:dns";
import net from "node:net";

/**
 * SSRF protection for user-supplied URLs.
 *
 * Every code path that fetches or navigates to a user-controlled URL (the
 * cheerio crawl, the Puppeteer screenshot, and — indirectly — PageSpeed) must
 * validate the target first. This module blocks non-http(s) schemes, bare/
 * private/reserved IP literals, and hostnames that resolve (via DNS) to
 * private, loopback, link-local, CGNAT, or cloud-metadata addresses.
 */

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

/**
 * Returns true if the given IP literal points at a non-public destination we
 * must never let the server reach (loopback, private LAN, link-local, CGNAT,
 * cloud metadata, unspecified, etc.). Accepts IPv4 and IPv6.
 */
export function isBlockedAddress(ip: string): boolean {
  const type = net.isIP(ip);
  if (type === 4) return isBlockedIpv4(ip);
  if (type === 6) return isBlockedIpv6(ip);
  // Not a valid IP literal — caller should have resolved it first.
  return true;
}

function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number.parseInt(p, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;

  if (a === 0) return true; // 0.0.0.0/8 "this host"
  if (a === 10) return true; // 10.0.0.0/8 private
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
  if (a === 192 && b === 0) return true; // 192.0.0.0/24 + 192.0.2.0/24 special-use
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmarking
  if (a >= 224) return true; // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved

  return false;
}

function isBlockedIpv6(ipRaw: string): boolean {
  const ip = ipRaw.toLowerCase().split("%")[0]; // strip zone id

  if (ip === "::" || ip === "::1") return true; // unspecified + loopback

  // IPv4-mapped / IPv4-compatible (::ffff:a.b.c.d) — validate the embedded v4.
  const mapped = ip.match(/(?:::ffff:)(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return isBlockedIpv4(mapped[1]);

  if (ip.startsWith("fe80")) return true; // link-local
  if (ip.startsWith("fc") || ip.startsWith("fd")) return true; // unique local (fc00::/7)
  if (ip.startsWith("ff")) return true; // multicast

  return false;
}

/**
 * Synchronous, DNS-free SSRF check for a single URL. Blocks disallowed schemes,
 * internal hostnames, and private/reserved IP literals. Used for per-request
 * filtering (e.g. Puppeteer request interception) where a DNS round-trip per
 * subresource would be too slow. The DNS-resolving {@link assertSafeExternalUrl}
 * still guards the primary navigation target.
 */
export function isBlockedUrlSync(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return true;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return true;

  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
  const lowerHost = hostname.toLowerCase();
  if (
    lowerHost === "localhost" ||
    lowerHost.endsWith(".localhost") ||
    lowerHost.endsWith(".local") ||
    lowerHost.endsWith(".internal") ||
    lowerHost === "metadata.google.internal"
  ) {
    return true;
  }
  if (net.isIP(hostname)) return isBlockedAddress(hostname);
  return false;
}

/**
 * Validates a user-supplied URL for SSRF safety. Throws {@link UnsafeUrlError}
 * when the URL is malformed, uses a disallowed scheme, or resolves to a
 * non-public address. Returns the parsed URL on success.
 */
export async function assertSafeExternalUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError("Please enter a valid website URL.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new UnsafeUrlError("Only http and https URLs are supported.");
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, ""); // unwrap [ipv6]

  // Block obvious internal names outright.
  const lowerHost = hostname.toLowerCase();
  if (
    lowerHost === "localhost" ||
    lowerHost.endsWith(".localhost") ||
    lowerHost.endsWith(".local") ||
    lowerHost.endsWith(".internal") ||
    lowerHost === "metadata.google.internal"
  ) {
    throw new UnsafeUrlError("This URL points to a private or internal host.");
  }

  // If the host is an IP literal, validate it directly.
  if (net.isIP(hostname)) {
    if (isBlockedAddress(hostname)) {
      throw new UnsafeUrlError("This URL points to a private or reserved IP address.");
    }
    return parsed;
  }

  // Otherwise resolve DNS and ensure NONE of the addresses are private. This
  // also defends against DNS rebinding where a hostname maps to an internal IP.
  let addresses: { address: string }[];
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    throw new UnsafeUrlError("Could not resolve that domain.");
  }

  if (addresses.length === 0) {
    throw new UnsafeUrlError("Could not resolve that domain.");
  }

  for (const { address } of addresses) {
    if (isBlockedAddress(address)) {
      throw new UnsafeUrlError("This URL resolves to a private or reserved IP address.");
    }
  }

  return parsed;
}
