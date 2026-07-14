"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, SearchX } from "lucide-react";

import { ReportView } from "@/components/report/report-view";
import { Button } from "@/components/ui/button";
import { REPORT_STORAGE_KEY } from "@/lib/report-store";
import type { ReportResponse } from "@/lib/types";

export default function ReportPage() {
  const [data, setData] = React.useState<ReportResponse | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem(REPORT_STORAGE_KEY);
      if (raw) setData(JSON.parse(raw) as ReportResponse);
    } catch {
      // Corrupt/missing payload — fall through to the empty state.
    }
    setReady(true);
  }, []);

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

  return <ReportView data={data} />;
}
