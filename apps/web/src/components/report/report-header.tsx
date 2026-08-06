"use client";

import * as React from "react";
import Link from "next/link";
import { upload } from "@vercel/blob/client";
import { Check, Copy, Download, FileJson, Loader2, Share2, Zap } from "lucide-react";

import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { scrollToBooking } from "@/lib/report-ui";
import { stripMockupSeed } from "@/lib/report-store";
import { safeHost } from "@/lib/utils";
import type { ReportResponse } from "@cro/shared";

export function ReportHeader({ data }: { data: ReportResponse }) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [sharing, setSharing] = React.useState(false);
  const [shareUrl, setShareUrl] = React.useState<string | null>(null);
  const [shareError, setShareError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

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
      const payload = JSON.stringify(stripMockupSeed(data));
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

  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-xl print:hidden">
      <div className="container flex h-16 items-center justify-between">
        <Logo />
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={shareReport}
            className="hidden sm:inline-flex"
          >
            <Share2 className="h-4 w-4" />
            Share
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={downloadJson}
            className="hidden sm:inline-flex"
          >
            <FileJson className="h-4 w-4" />
            JSON
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.print()}
            className="hidden sm:inline-flex"
          >
            <Download className="h-4 w-4" />
            PDF
          </Button>
          {/* Demoted to a low-contrast text link — keep focus on fixing THIS page */}
          <Link
            href="/#analyze"
            className="hidden text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline sm:inline"
          >
            Analyze another
          </Link>
          {/* Primary conversion action: high-contrast amber, scrolls to booking */}
          <Button
            type="button"
            size="sm"
            onClick={scrollToBooking}
            className="bg-amber-500 font-semibold text-white shadow-sm shadow-amber-500/25 hover:bg-amber-600 hover:shadow-amber-500/40"
          >
            <Zap className="h-4 w-4" />
            Fix My Page
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
              required. Links stay active for about 30 days.
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
        </DialogContent>
      </Dialog>
    </header>
  );
}
