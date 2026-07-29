import { describe, it, expect } from "vitest";
import { isBlockedAddress, isBlockedUrlSync, assertSafeExternalUrl, UnsafeUrlError } from "./net-guard";

describe("isBlockedAddress", () => {
  it("blocks loopback + private + link-local + metadata IPv4", () => {
    for (const ip of [
      "127.0.0.1",
      "10.0.0.5",
      "172.16.4.4",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254", // cloud metadata
      "100.64.0.1", // CGNAT
      "0.0.0.0",
    ]) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
  });

  it("allows public IPv4", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "93.184.216.34"]) {
      expect(isBlockedAddress(ip), ip).toBe(false);
    }
  });

  it("blocks loopback + ULA + link-local IPv6", () => {
    for (const ip of ["::1", "fe80::1", "fc00::1", "fd12:3456::1", "::ffff:127.0.0.1"]) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
  });

  it("allows public IPv6", () => {
    expect(isBlockedAddress("2606:4700:4700::1111")).toBe(false);
  });
});

describe("isBlockedUrlSync", () => {
  it("blocks non-http(s) schemes", () => {
    expect(isBlockedUrlSync("file:///etc/passwd")).toBe(true);
    expect(isBlockedUrlSync("ftp://example.com")).toBe(true);
    expect(isBlockedUrlSync("data:text/html,hi")).toBe(true);
  });

  it("blocks internal hostnames + private IP literals", () => {
    expect(isBlockedUrlSync("http://localhost/")).toBe(true);
    expect(isBlockedUrlSync("http://foo.internal/")).toBe(true);
    expect(isBlockedUrlSync("http://169.254.169.254/latest/meta-data/")).toBe(true);
    expect(isBlockedUrlSync("http://192.168.0.1/")).toBe(true);
  });

  it("allows normal public URLs", () => {
    expect(isBlockedUrlSync("https://example.com/path")).toBe(false);
    expect(isBlockedUrlSync("http://8.8.8.8/")).toBe(false);
  });

  it("blocks malformed URLs", () => {
    expect(isBlockedUrlSync("not a url")).toBe(true);
  });
});

describe("assertSafeExternalUrl", () => {
  it("rejects private IP literals without DNS", async () => {
    await expect(assertSafeExternalUrl("http://127.0.0.1/")).rejects.toBeInstanceOf(
      UnsafeUrlError
    );
    await expect(
      assertSafeExternalUrl("http://169.254.169.254/")
    ).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it("rejects disallowed schemes", async () => {
    await expect(assertSafeExternalUrl("file:///etc/passwd")).rejects.toBeInstanceOf(
      UnsafeUrlError
    );
  });

  it("rejects internal hostnames", async () => {
    await expect(assertSafeExternalUrl("http://localhost/")).rejects.toBeInstanceOf(
      UnsafeUrlError
    );
  });
});
