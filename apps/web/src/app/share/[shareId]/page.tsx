"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, SearchX } from "lucide-react";

import { ReportView } from "@/components/report/report-view";
import { Button } from "@/components/ui/button";
import type { ReportResponse } from "@cro/shared";

type LoadState = "loading" | "ready" | "notfound" | "error";

export default function SharedReportPage({
  params,
}: {
  params: { shareId: string };
}) {
  const { shareId } = params;
  const [data, setData] = React.useState<ReportResponse | null>(null);
  const [state, setState] = React.useState<LoadState>("loading");

  React.useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        // Resolve the shareId to its public Blob URL, then fetch the JSON
        // directly from the CDN (keeps the multi-MB payload off our functions).
        const res = await fetch(`/api/share/${shareId}`, {
          signal: controller.signal,
        });
        if (res.status === 404) {
          setState("notfound");
          return;
        }
        if (!res.ok) {
          setState("error");
          return;
        }
        const { url } = (await res.json()) as { url: string };
        const reportRes = await fetch(url, { signal: controller.signal });
        if (!reportRes.ok) {
          setState("error");
          return;
        }
        const report = (await reportRes.json()) as ReportResponse;
        setData(report);
        setState("ready");
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setState("error");
      }
    })();

    return () => controller.abort();
  }, [shareId]);

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state !== "ready" || !data) {
    const isNotFound = state === "notfound";
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border bg-muted/40">
          <SearchX className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">
            {isNotFound ? "This shared report isn't available" : "Couldn't load this report"}
          </h1>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            {isNotFound
              ? "The link may be incorrect or the report may have been removed. Ask for a fresh link, or run your own audit."
              : "Something went wrong loading this shared report. Please try again in a moment."}
          </p>
        </div>
        <Button asChild variant="gradient">
          <Link href="/#analyze">Analyze a website</Link>
        </Button>
      </div>
    );
  }

  // The generated mockup is already embedded in the shared payload, so the
  // deferred client-side mockup fetch (report page) is intentionally not run.
  return (
    <ReportView data={data} readOnly mockupPending={false} mockupError={false} />
  );
}
