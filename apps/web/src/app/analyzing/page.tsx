"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, SearchX } from "lucide-react";

import { ScanExperience } from "@/components/scan/scan-experience";
import { Button } from "@/components/ui/button";
import { storeReport } from "@/lib/report-store";
import { takePendingScan, type PendingScan } from "@/lib/pending-scan";
import type { ReportResponse } from "@cro/shared";

export default function AnalyzingPage() {
  const router = useRouter();
  const [scan, setScan] = React.useState<PendingScan | null>(null);
  const [ready, setReady] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // takePendingScan() consumes (clears) the stored request, so guard against
  // React StrictMode's double-invoked effect clobbering it with a null re-read.
  const consumed = React.useRef(false);

  React.useEffect(() => {
    if (consumed.current) return;
    consumed.current = true;
    setScan(takePendingScan());
    setReady(true);
  }, []);

  function handleComplete(data: ReportResponse) {
    const stored = storeReport(data);
    if (!stored.ok) {
      setError(
        "Your report was generated but is too large to open in this browser. Try a different browser or disable private mode, then run it again."
      );
      return;
    }
    router.replace("/report");
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (!scan) {
    return (
      <ErrorState message="We couldn't find a website to analyze. Please enter your URL again." />
    );
  }

  return (
    <ScanExperience scan={scan} onComplete={handleComplete} onError={setError} />
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border bg-muted/40">
        <SearchX className="h-6 w-6 text-muted-foreground" />
      </div>
      <div>
        <h1 className="text-xl font-semibold">Analysis didn&apos;t finish</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">{message}</p>
      </div>
      <Button asChild variant="gradient">
        <Link href="/#analyze">Try again</Link>
      </Button>
    </div>
  );
}
