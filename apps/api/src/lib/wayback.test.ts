import { describe, expect, it } from "vitest";
import {
  archiveReplayUrl,
  cdxSearchParams,
  formatCdxTimestamp,
  parseCdxRows,
  parseWaybackUrl,
} from "./wayback";

describe("parseWaybackUrl", () => {
  it("reads timestamp and original from a replay URL", () => {
    const hit = parseWaybackUrl(
      "https://web.archive.org/web/20240315123045/https://www.fastly.com/request-a-demo"
    );
    expect(hit?.timestamp).toBe("20240315123045");
    expect(hit?.original).toBe("https://www.fastly.com/request-a-demo");
    expect(hit?.capturedAt).toBe("March 15, 2024");
  });

  it("accepts id_ rewritten replays", () => {
    const hit = parseWaybackUrl(
      "https://web.archive.org/web/20240315123045id_/https://example.com/"
    );
    expect(hit?.original).toBe("https://example.com/");
  });

  it("returns null for a normal site URL", () => {
    expect(parseWaybackUrl("https://www.fastly.com/request-a-demo")).toBeNull();
  });

  it("accepts archive.org and an 8-digit stamp", () => {
    const hit = parseWaybackUrl(
      "https://archive.org/web/20240315/https://www.fastly.com/request-a-demo"
    );
    expect(hit?.timestamp).toBe("20240315000000");
    expect(hit?.original).toBe("https://www.fastly.com/request-a-demo");
  });
});

describe("formatCdxTimestamp", () => {
  it("formats a 14-digit CDX stamp as a UTC calendar date", () => {
    expect(formatCdxTimestamp("20240315123045")).toBe("March 15, 2024");
  });

  it("returns the raw stamp when it is not 14 digits", () => {
    expect(formatCdxTimestamp("nope")).toBe("nope");
  });
});

describe("archiveReplayUrl", () => {
  it("builds a rewritten replay URL (not if_/id_) so CSS can load", () => {
    expect(archiveReplayUrl("20240315123045", "https://www.fastly.com/")).toBe(
      "https://web.archive.org/web/20240315123045/https://www.fastly.com/"
    );
    expect(archiveReplayUrl("20240315123045", "https://www.fastly.com/")).not.toContain(
      "if_"
    );
  });
});

describe("cdxSearchParams", () => {
  it("asks CDX for the last captures, not the first ten", () => {
    const params = cdxSearchParams("https://www.fastly.com/request-a-demo");
    expect(params.get("url")).toBe("https://www.fastly.com/request-a-demo");
    expect(params.get("limit")).toBe("-5");
    expect(params.get("fastLatest")).toBe("true");
    expect(params.get("filter")).toBe("statuscode:200");
    expect(params.get("output")).toBe("json");
  });
});

describe("parseCdxRows", () => {
  it("picks the newest HTTP 200 row and ignores errors", () => {
    const hit = parseCdxRows([
      ["timestamp", "original", "statuscode", "mimetype"],
      ["20220101000000", "https://example.com/", "200", "text/html"],
      ["20240315123045", "https://example.com/", "200", "text/html"],
      ["20240401000000", "https://example.com/", "403", "text/html"],
      ["20240501000000", "https://example.com/", "200", "image/jpeg"],
    ]);
    expect(hit).toEqual({
      timestamp: "20240315123045",
      replayUrl:
        "https://web.archive.org/web/20240315123045/https://example.com/",
      capturedAt: "March 15, 2024",
    });
  });

  it("still picks the newest when CDX returns latest-first", () => {
    const hit = parseCdxRows([
      ["timestamp", "original", "statuscode", "mimetype"],
      ["20260301120000", "https://example.com/", "200", "text/html"],
      ["20251201000000", "https://example.com/", "200", "text/html"],
      ["20240101000000", "https://example.com/", "200", "text/html"],
    ]);
    expect(hit?.timestamp).toBe("20260301120000");
    expect(hit?.capturedAt).toBe("March 1, 2026");
  });

  it("returns null for empty or header-only payloads", () => {
    expect(parseCdxRows([])).toBeNull();
    expect(parseCdxRows([["timestamp", "original", "statuscode"]])).toBeNull();
    expect(parseCdxRows(null)).toBeNull();
    expect(parseCdxRows({ error: "nope" })).toBeNull();
  });
});
