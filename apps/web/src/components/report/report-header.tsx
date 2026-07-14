"use client";

import * as React from "react";
import Link from "next/link";
import { Download, FileJson, Plus } from "lucide-react";

import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import type { ReportResponse } from "@/lib/types";

export function ReportHeader({ data }: { data: ReportResponse }) {
  function downloadJson() {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const host = safeHost(data.scan.url);
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
          <Button asChild variant="outline" size="sm">
            <Link href="/#analyze">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Analyze another</span>
            </Link>
          </Button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "site";
  }
}
