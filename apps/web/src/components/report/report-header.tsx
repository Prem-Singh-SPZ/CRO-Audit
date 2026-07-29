"use client";

import * as React from "react";
import Link from "next/link";
import { Download, FileJson, Zap } from "lucide-react";

import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { scrollToBooking } from "@/lib/report-ui";
import { safeHost } from "@/lib/utils";
import type { ReportResponse } from "@/lib/types";

export function ReportHeader({ data }: { data: ReportResponse }) {
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

  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-xl print:hidden">
      <div className="container flex h-16 items-center justify-between">
        <Logo />
        <div className="flex items-center gap-2">
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
    </header>
  );
}
