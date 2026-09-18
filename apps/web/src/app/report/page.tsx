"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, SearchX } from "lucide-react";

import { ReportView } from "@/components/report/report-view";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/api";
import { composeMockup } from "@/lib/composed-mockup";
import {
  REPORT_STORAGE_KEY,
  storeReport,
  stripMockupSeed,
  normalizeReport,
} from "@/lib/report-store";
import { safeHost } from "@/lib/utils";
import type {
  MockupDto,
  MockupFailureReason,
  MockupResponseDto,
  ReportResponse,
} from "@cro/shared";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function persistMockups(
  received: MockupDto[],
  setData: React.Dispatch<React.SetStateAction<ReportResponse | null>>
) {
  setData((prev) => {
    if (!prev) return prev;
    const next = stripMockupSeed({ ...prev, mockups: received });
    storeReport(next);
    return next;
  });
}

export default function ReportPage() {
  const [data, setData] = React.useState<ReportResponse | null>(null);
  const [ready, setReady] = React.useState(false);
  const [mockupPending, setMockupPending] = React.useState(false);
  const inFlight = React.useRef(false);

  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem(REPORT_STORAGE_KEY);
      if (raw) setData(normalizeReport(JSON.parse(raw) as ReportResponse));
    } catch {
      // Corrupt/missing payload — fall through to the empty state.
    }
    setReady(true);
  }, []);

  // Fetch the "after" concept out-of-band. Retry Gemini, then always compose
  // an overlay on the real screenshot so "If we redesigned it" never blanks.
  React.useEffect(() => {
    if (!data || data.blocked) return;
    if (data.liveTest || data.incompleteCapture) {
      setMockupPending(false);
      return;
    }
    if (data.mockups.length > 0) return;
    const canGenerate = !!data.mockupSeed;
    const canCompose = data.screenshots.some((s) => s.url);
    if (!canGenerate && !canCompose) return;

    if (!canGenerate && canCompose) {
      const composed = composeMockup(data);
      if (composed) persistMockups([composed], setData);
      return;
    }

    if (inFlight.current) return;
    inFlight.current = true;

    const controller = new AbortController();
    setMockupPending(true);

    (async () => {
      try {
        for (let attempt = 0; attempt < 3; attempt++) {
          if (controller.signal.aborted) return;
          try {
            const res = await fetch(apiUrl("/api/mockup"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: controller.signal,
              body: JSON.stringify({
                image: data.mockupSeed!.image,
                mimeType: data.mockupSeed!.mimeType,
                host: safeHost(data.scan.url),
                rotateSeed: `${safeHost(data.scan.url)}:${data.scan.id}`,
                primaryBottleneck: data.report.primaryBottleneck || undefined,
                issues: data.issues.map((i) => ({
                  severity: i.severity,
                  category: i.category,
                  title: i.title,
                  description: i.description,
                })),
              }),
            });
            const json = (await res.json().catch(() => null)) as
              | MockupResponseDto
              | { reason?: MockupFailureReason }
              | null;
            if (res.status === 413) break;
            const reason =
              json && "reason" in json ? json.reason : undefined;
            if (reason === "disabled" || reason === "no_key") break;
            if (res.status === 429 || !res.ok) {
              if (attempt < 2) {
                await sleep(800 * (attempt + 1));
                continue;
              }
              break;
            }
            const received =
              json && "mockups" in json && json.mockups && json.mockups.length > 0
                ? json.mockups
                : json && "mockup" in json && json.mockup
                  ? [json.mockup]
                  : [];
            if (received.length > 0) {
              persistMockups(received, setData);
              return;
            }
          } catch (err) {
            if (err instanceof DOMException && err.name === "AbortError") return;
          }
          if (attempt < 2) await sleep(800 * (attempt + 1));
        }
        if (controller.signal.aborted) return;
        const composed = composeMockup(data);
        if (composed) persistMockups([composed], setData);
      } finally {
        setMockupPending(false);
        inFlight.current = false;
      }
    })();

    return () => {
      controller.abort();
      inFlight.current = false;
    };
  }, [data]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border bg-muted/40">
          <SearchX className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">No report to show</h1>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Reports are generated on the fly. Enter a website URL to run a fresh
            CRO audit.
          </p>
        </div>
        <Button asChild variant="gradient">
          <Link href="/#analyze">Analyze a website</Link>
        </Button>
      </div>
    );
  }

  return <ReportView data={data} mockupPending={mockupPending} />;
}
