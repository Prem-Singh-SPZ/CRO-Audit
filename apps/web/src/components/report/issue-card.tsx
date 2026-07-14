"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, TrendingUp, Target, Wrench, Info } from "lucide-react";

import type { IssueDto } from "@/lib/types";
import { SEVERITY_META } from "@/lib/report-ui";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function IssueCard({ issue }: { issue: IssueDto }) {
  const [open, setOpen] = React.useState(false);
  const meta = SEVERITY_META[issue.severity];

  return (
    <div className="card-premium overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-4 p-5 text-left"
      >
        <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", meta.dot)} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={meta.badge}>{meta.label}</Badge>
            <span className="text-xs text-muted-foreground">{issue.category}</span>
          </div>
          <h3 className="mt-1.5 font-semibold">{issue.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {issue.description}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-success">
            <TrendingUp className="h-3.5 w-3.5" />
            {issue.estimatedConversionImpact}
          </span>
          <ChevronDown
            className={cn(
              "h-5 w-5 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
          />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="space-y-4 border-t px-5 py-5">
              <Detail icon={Info} title="Why it matters" text={issue.whyItMatters} />
              <Detail
                icon={Target}
                title="Business impact"
                text={issue.businessImpact}
              />
              <Detail
                icon={Wrench}
                title="Suggested fix"
                text={issue.suggestedFix}
                highlight
              />
              <div className="flex items-center gap-4 pt-1 text-xs text-muted-foreground">
                <span>Confidence: {issue.confidence}%</span>
                {issue.device && <span>Device: {issue.device}</span>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Detail({
  icon: Icon,
  title,
  text,
  highlight,
}: {
  icon: typeof Info;
  title: string;
  text: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl p-3.5",
        highlight ? "bg-accent/50" : "bg-muted/40"
      )}
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      <p className="mt-1.5 text-sm leading-relaxed">{text}</p>
    </div>
  );
}
