"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, SearchX, ShieldAlert } from "lucide-react";

import { ReportView } from "@/components/report/report-view";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/api";
import {
  REPORT_STORAGE_KEY,
  storeReport,
  stripMockupSeed,
} from "@/lib/report-store";
import { safeHost } from "@/lib/utils";
import type { MockupResponseDto, ReportResponse } from "@cro/shared";

export default function ReportPage() {
  const [data, setData] = React.useState<ReportResponse | null>(null);
  const [ready, setReady] = React.useState(false);
  const [mockupPending, setMockupPending] = React.useState(false);
  const [mockupError, setMockupError] = React.useState(false);
  // Guards the one-shot background mockup fetch against React's dev double-run.
  const mockupRequested = React.useRef(false);

  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem(REPORT_STORAGE_KEY);
      if (raw) setData(JSON.parse(raw) as ReportResponse);
    } catch {
      // Corrupt/missing payload — fall through to the empty state.
    }
    setReady(true);
  }, []);

  // Fetch the "after" concept out-of-band once the core report is on screen,
  // then merge it in and persist so a refresh doesn't regenerate it.
  React.useEffect(() => {
    if (!data || mockupRequested.current) return;
    if (!data.mockupSeed || data.mockups.length > 0) return;
    mockupRequested.current = true;

    const controller = new AbortController();
    setMockupPending(true);

    (async () => {
      try {
        const res = await fetch(apiUrl("/api/mockup"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            image: data.mockupSeed!.image,
            mimeType: data.mockupSeed!.mimeType,
            host: safeHost(data.scan.url),
            primaryBottleneck: data.report.primaryBottleneck || undefined,
            issues: data.issues.map((i) => ({
              severity: i.severity,
              category: i.category,
              title: i.title,
              description: i.description,
            })),
          }),
        });
        if (!res.ok) throw new Error(`mockup HTTP ${res.status}`);
        const json = (await res.json()) as MockupResponseDto;
        if (json.mockup) {
          setData((prev) => {
            if (!prev) return prev;
            // Drop the now-consumed seed to reclaim sessionStorage space.
            const next = stripMockupSeed({ ...prev, mockups: [json.mockup!] });
            storeReport(next);
            return next;
          });
        } else {
          // Endpoint intentionally returned no mockup (disabled / no key).
          setMockupError(true);
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setMockupError(true);
        }
      } finally {
        setMockupPending(false);
      }
    })();

    return () => controller.abort();
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

  if (data.blocked) {
    return <BlockedState data={data} />;
  }

  return (
    <ReportView
      data={data}
      mockupPending={mockupPending}
      mockupError={mockupError}
    />
  );
}

// Shown when the target sat behind bot protection and the real page could not
// be read. We deliberately don't render the neutral placeholder scorecard —
// that reads like a real (bad) audit. Instead we explain what happened and give
// the user clear next steps.
function BlockedState({ data }: { data: ReportResponse }) {
  const host = safeHost(data.scan.url);
  const reason = data.blockReason?.toLowerCase() ?? "bot protection";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10">
        <ShieldAlert className="h-6 w-6 text-amber-500" aria-hidden="true" />
      </div>

      <div className="max-w-lg space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          We couldn&apos;t read {host}
        </h1>
        <p className="text-sm text-muted-foreground">
          This site is protected by a security firewall ({reason}) that blocked
          our automated reader before it could load the real page. That&apos;s a
          security positive for the site — but it means we couldn&apos;t audit
          the live content this time.
        </p>
      </div>

      <div className="w-full max-w-lg rounded-xl border bg-muted/30 p-5 text-left">
        <p className="text-sm font-medium">A few things that often work:</p>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <span aria-hidden="true">•</span>
            <span>
              <strong className="font-medium text-foreground">Try again</strong>{" "}
              in a minute — some challenges are intermittent and clear on a
              second attempt.
            </span>
          </li>
          <li className="flex gap-2">
            <span aria-hidden="true">•</span>
            <span>
              <strong className="font-medium text-foreground">
                Audit a specific landing page
              </strong>{" "}
              (e.g. a campaign or product URL) instead of the gated homepage —
              those are less likely to sit behind the firewall.
            </span>
          </li>
          <li className="flex gap-2">
            <span aria-hidden="true">•</span>
            <span>
              <strong className="font-medium text-foreground">
                Request a manual review
              </strong>{" "}
              if the whole domain is protected — a human can audit what the
              crawler can&apos;t reach.
            </span>
          </li>
        </ul>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild variant="gradient">
          <Link href="/#analyze">Analyze another URL</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </div>
  );
}
