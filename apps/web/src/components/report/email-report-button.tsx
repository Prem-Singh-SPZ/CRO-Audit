"use client";

import * as React from "react";
import { Check, Loader2, Mail } from "lucide-react";

import type { ReportResponse } from "@cro/shared";
import { Button } from "@/components/ui/button";
import { safeHost } from "@/lib/utils";
import { uploadReportForShare } from "@/lib/verification";
import { useReportGate } from "./report-gate";

export function EmailReportButton({ data }: { data: ReportResponse }) {
  const { verified, token, email, openGate } = useReportGate();
  const [status, setStatus] = React.useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = React.useState<string | null>(null);

  async function sendIt() {
    // Unverified users must verify first — the gate mints the token we need.
    if (!verified || !token) {
      openGate();
      return;
    }
    setStatus("sending");
    setError(null);
    try {
      const shareUrl = await uploadReportForShare(data);
      const res = await fetch("/api/report/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          shareUrl,
          host: safeHost(data.scan.url, "your site"),
          score: data.report.overallScore,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Couldn't send the email.");
      setStatus("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("idle");
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={sendIt}
        disabled={status === "sending" || status === "sent"}
      >
        {status === "sending" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : status === "sent" ? (
          <Check className="h-4 w-4 text-success" />
        ) : (
          <Mail className="h-4 w-4" />
        )}
        {status === "sent"
          ? email
            ? `Sent to ${email}`
            : "Report sent"
          : status === "sending"
            ? "Sending…"
            : "Email me this report"}
      </Button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
