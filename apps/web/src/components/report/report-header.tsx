"use client";

import * as React from "react";
import Link from "next/link";
import { upload } from "@vercel/blob/client";
import {
  Check,
  Copy,
  Download,
  FileJson,
  Loader2,
  Mail,
  MoreHorizontal,
  Share2,
  Zap,
} from "lucide-react";

import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { slimForShare } from "@/lib/report-store";
import { config } from "@/lib/config";
import { emailReportPayload } from "@/lib/email-report-payload";
import { safeHost } from "@/lib/utils";
import type { ReportResponse } from "@cro/shared";
import { useReportGate } from "./report-gate";

export function ReportHeader({ data }: { data: ReportResponse }) {
  const { verified, token, email, openGate, resetVerification } = useReportGate();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [sharing, setSharing] = React.useState(false);
  const [shareUrl, setShareUrl] = React.useState<string | null>(null);
  const [shareError, setShareError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [emailStatus, setEmailStatus] = React.useState<
    "idle" | "sending" | "sent"
  >("idle");
  const [emailError, setEmailError] = React.useState<string | null>(null);

  function downloadJson() {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const host = safeHost(data.scan.url, "site");
    const a = document.createElement("a");
    a.href = url;
    a.download = `cro-report-${host}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function shareReport() {
    setDialogOpen(true);
    if (shareUrl) return; // Already generated for this report — reuse the link.
    setSharing(true);
    setShareError(null);
    try {
      const id = crypto.randomUUID();
      // Drop the one-time mockup seed; the generated image already lives in
      // `mockups[]`, so this keeps the stored payload smaller.
      const payload = JSON.stringify(slimForShare(data));
      await upload(`reports/${id}.json`, payload, {
        access: "public",
        handleUploadUrl: "/api/share/upload",
        contentType: "application/json",
      });
      setShareUrl(`${window.location.origin}/share/${id}`);
    } catch {
      setShareError(
        "We couldn't create a share link. Sharing may not be configured yet — please try again later."
      );
    } finally {
      setSharing(false);
    }
  }

  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — the input stays selectable for manual copy.
    }
  }

  // Send-to-self: emails the report to the address the user verified at the
  // unlock gate. The server derives the recipient from the token, so this can
  // never be pointed at an arbitrary address.
  async function emailReport() {
    if (!verified || !token) {
      openGate(); // gate mints the token we need
      return;
    }
    setEmailStatus("sending");
    setEmailError(null);
    try {
      const res = await fetch("/api/report/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailReportPayload(data, token, shareUrl)),
      });
      const body = await res.json().catch(() => null);
      if (res.status === 401) {
        resetVerification();
        setEmailStatus("idle");
        return;
      }
      if (!res.ok) throw new Error(body?.error ?? "Couldn't send the email.");
      setEmailStatus("sent");
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Something went wrong.");
      setEmailStatus("idle");
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-xl print:hidden">
      <div className="container flex h-16 items-center justify-between gap-2">
        <Logo />
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={shareReport}
            className="hidden lg:inline-flex"
          >
            <Share2 className="h-4 w-4" />
            Share
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={downloadJson}
            className="hidden lg:inline-flex"
          >
            <FileJson className="h-4 w-4" />
            JSON
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.print()}
            className="hidden lg:inline-flex"
          >
            <Download className="h-4 w-4" />
            PDF
          </Button>
          {/* Demoted to a low-contrast text link — keep focus on fixing THIS page */}
          <Link
            href="/#analyze"
            className="hidden text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline lg:inline"
          >
            Analyze another
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="More report actions"
              >
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={shareReport}>
                <Share2 className="h-4 w-4" />
                Share
              </DropdownMenuItem>
              <DropdownMenuItem onClick={downloadJson}>
                <FileJson className="h-4 w-4" />
                Download JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.print()}>
                <Download className="h-4 w-4" />
                Download PDF
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/#analyze">Analyze another</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            asChild
            size="sm"
            className="bg-amber-500 px-3 font-semibold text-white shadow-sm shadow-amber-500/25 hover:bg-amber-600 hover:shadow-amber-500/40 sm:px-4"
          >
            <Link
              href={config.bookCallUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Zap className="h-4 w-4" />
              <span className="min-[400px]:hidden">Fix</span>
              <span className="hidden min-[400px]:inline">Fix My Page</span>
            </Link>
          </Button>
          <ThemeToggle />
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share this report</DialogTitle>
            <DialogDescription>
              Anyone with this link can view the full read-only report — no login
              required. Copy the link to share it. Emailing sends a summary of
              the report to your verified address. Links stay active for about
              30 days.
            </DialogDescription>
          </DialogHeader>

          {sharing ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating your share link…
            </div>
          ) : shareError ? (
            <p className="py-2 text-sm text-destructive">{shareError}</p>
          ) : shareUrl ? (
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={shareUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="h-10 flex-1 rounded-full border border-input bg-background/50 px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copyLink}
                className="shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          ) : null}

          {/* Send-to-self: emails the verified address via the OTP-gated
              endpoint. Recipient is derived from the token server-side. */}
          <div className="mt-4 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={emailReport}
              disabled={emailStatus === "sending" || emailStatus === "sent"}
            >
              {emailStatus === "sending" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : emailStatus === "sent" ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              {emailStatus === "sent"
                ? email
                  ? `Sent to ${email}`
                  : "Report sent"
                : emailStatus === "sending"
                  ? "Sending…"
                  : verified
                    ? `Email this report to ${email ?? "me"}`
                    : "Verify your email to send this report"}
            </Button>
            {emailError ? (
              <p className="mt-1 text-xs text-destructive">{emailError}</p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
