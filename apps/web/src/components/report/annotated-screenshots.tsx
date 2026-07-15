"use client";

import * as React from "react";
import { Monitor, Tablet, Smartphone } from "lucide-react";

import type { IssueDto, ScreenshotDto } from "@/lib/types";
import { SEVERITY_META } from "@/lib/report-ui";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Device = "desktop" | "tablet" | "mobile";

const DEVICE_TABS: { key: Device; icon: typeof Monitor; label: string }[] = [
  { key: "desktop", icon: Monitor, label: "Desktop" },
  { key: "tablet", icon: Tablet, label: "Tablet" },
  { key: "mobile", icon: Smartphone, label: "Mobile" },
];

export function AnnotatedScreenshots({
  screenshots,
  issues,
}: {
  screenshots: ScreenshotDto[];
  issues: IssueDto[];
}) {
  const available = DEVICE_TABS.filter((t) =>
    screenshots.some((s) => s.device === t.key)
  );
  const [device, setDevice] = React.useState<Device>(
    available[0]?.key ?? "desktop"
  );

  const active = screenshots.find((s) => s.device === device);
  // Only pin annotations when there's an image to pin them onto.
  const pins = active
    ? issues.filter(
        (i) =>
          i.device === device &&
          i.annotationX != null &&
          i.annotationY != null
      )
    : [];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="inline-flex rounded-full border bg-muted/50 p-1">
          {available.map((t) => (
            <button
              key={t.key}
              onClick={() => setDevice(t.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                device === t.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          {pins.length} annotation{pins.length === 1 ? "" : "s"}
        </span>
      </div>

      <div
        className={cn(
          "relative mx-auto overflow-hidden rounded-xl border bg-muted/30",
          device === "mobile" ? "max-w-[360px]" : "max-w-full"
        )}
      >
        {active ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={active.url}
            alt={`${device} screenshot`}
            className="block h-auto w-full"
          />
        ) : (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            No screenshot available
          </div>
        )}

        {pins.map((issue, idx) => {
          const meta = SEVERITY_META[issue.severity];
          return (
            <Tooltip key={issue.id}>
              <TooltipTrigger asChild>
                <button
                  className="group absolute z-10 -translate-x-1/2 -translate-y-1/2"
                  style={{
                    left: `${(issue.annotationX ?? 0) * 100}%`,
                    top: `${(issue.annotationY ?? 0) * 100}%`,
                  }}
                  aria-label={issue.title}
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white shadow-lg ring-2 ring-white/70 transition-transform group-hover:scale-125",
                      meta.dot
                    )}
                  >
                    {idx + 1}
                  </span>
                  <span
                    className={cn(
                      "absolute inset-0 -z-10 animate-ping rounded-full opacity-40",
                      meta.dot
                    )}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="w-80 max-w-[85vw] space-y-2 p-3 text-left"
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge className={meta.badge}>{meta.label}</Badge>
                  <span className="text-xs font-medium text-success">
                    {issue.estimatedConversionImpact}
                  </span>
                </div>
                <h4 className="text-sm font-semibold">{issue.title}</h4>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {issue.description}
                </p>
                <div className="rounded-lg bg-accent/50 p-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                    Recommended fix
                  </p>
                  <p className="mt-1 text-xs leading-relaxed">
                    {issue.suggestedFix}
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
