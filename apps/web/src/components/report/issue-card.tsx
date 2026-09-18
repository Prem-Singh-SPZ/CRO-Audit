"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  TrendingUp,
  Target,
  Info,
  Brain,
  Lock,
  Wrench,
  AlertTriangle,
  CalendarClock,
} from "lucide-react";

import type { IssueDto } from "@cro/shared";
import {
  SEVERITY_META,
  COMPLEXITY_META,
  DIY_RISK_META,
  liftEvidence,
} from "@/lib/report-ui";
import { useReportGate } from "./report-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { config } from "@/lib/config";
import Link from "next/link";

export function IssueCard({
  issue,
  selected = false,
  onSelect,
  pageUrl,
}: {
  issue: IssueDto;
  selected?: boolean;
  onSelect?: (id: string) => void;
  pageUrl?: string;
}) {
  const [open, setOpen] = React.useState(selected);
  const [whyOpen, setWhyOpen] = React.useState(false);
  const meta = SEVERITY_META[issue.severity];
  const panelId = React.useId();
  const whyId = React.useId();
  const evidence = liftEvidence(issue.category);

  React.useEffect(() => {
    if (selected) setOpen(true);
  }, [selected]);

  return (
    <div
      id={`issue-${issue.id}`}
      className={cn(
        "card-premium overflow-hidden border-l-4 scroll-mt-24",
        meta.accent,
        selected && "ring-2 ring-primary/40"
      )}
    >
      <button
        onClick={() => {
          setOpen((v) => !v);
          onSelect?.(issue.id);
        }}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-start gap-4 p-5 text-left"
      >
        <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", meta.dot)} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={meta.badge}>{meta.label}</Badge>
            {issue.complexity && (
              <Badge className={cn("gap-1", COMPLEXITY_META[issue.complexity].badge)}>
                <Wrench className="h-3 w-3" />
                {COMPLEXITY_META[issue.complexity].label}
              </Badge>
            )}
            {issue.riskOfDiy && (
              <Badge className={cn("gap-1", DIY_RISK_META[issue.riskOfDiy].badge)}>
                <AlertTriangle className="h-3 w-3" />
                {DIY_RISK_META[issue.riskOfDiy].label}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">{issue.category}</span>
          </div>
          <h3 className="mt-1.5 font-semibold">{issue.title}</h3>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-success">
            <TrendingUp className="h-3.5 w-3.5" />
            {issue.estimatedConversionImpact}
          </span>
          {evidence ? (
            <span className="max-w-[9.5rem] text-right text-[10px] leading-tight text-muted-foreground">
              {evidence}
            </span>
          ) : null}
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
            id={panelId}
          >
            <div className="space-y-4 border-t px-5 py-5">
              <GatedFix text={issue.suggestedFix} />
              {(issue.psychology || issue.whyItMatters || issue.businessImpact) && (
                <div>
                  <button
                    type="button"
                    onClick={() => setWhyOpen((v) => !v)}
                    aria-expanded={whyOpen}
                    aria-controls={whyId}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 transition-transform",
                        whyOpen && "rotate-180"
                      )}
                    />
                    Why this matters
                  </button>
                  <AnimatePresence initial={false}>
                    {whyOpen && (
                      <motion.div
                        id={whyId}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 space-y-3">
                          {issue.psychology && (
                            <Detail
                              icon={Brain}
                              title="Psychology — why users leave"
                              text={issue.psychology}
                            />
                          )}
                          {issue.whyItMatters && (
                            <Detail
                              icon={Info}
                              title="Why it matters"
                              text={issue.whyItMatters}
                            />
                          )}
                          {issue.businessImpact && (
                            <Detail
                              icon={Target}
                              title="Business impact"
                              text={issue.businessImpact}
                            />
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-muted-foreground">
                <span>Confidence: {issue.confidence}%</span>
                {issue.device && <span>Device: {issue.device}</span>}
                <FindingFeedback issueTitle={issue.title} pageUrl={pageUrl} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FindingFeedback({
  issueTitle,
  pageUrl,
}: {
  issueTitle: string;
  pageUrl?: string;
}) {
  const { verified, token } = useReportGate();
  const [state, setState] = React.useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );

  if (!verified || !token) return null;

  async function submit() {
    if (state === "sending" || state === "sent") return;
    setState("sending");
    try {
      const res = await fetch("/api/finding-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          issueTitle,
          url: pageUrl,
        }),
      });
      if (!res.ok) throw new Error("feedback failed");
      setState("sent");
    } catch {
      setState("error");
    }
  }

  if (state === "sent") {
    return <span className="text-muted-foreground">Thanks — we’ll review this.</span>;
  }

  return (
    <button
      type="button"
      onClick={submit}
      disabled={state === "sending"}
      className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-60"
    >
      {state === "sending"
        ? "Sending…"
        : state === "error"
          ? "Couldn’t send — try again"
          : "This finding is wrong"}
    </button>
  );
}

function GatedFix({ text }: { text: string }) {
  const teaser = text.replace(/\[[^\]]*\]/g, "").trim();

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
        <Lock className="h-3.5 w-3.5" />
        Recommended fix
      </div>
      <p className="mt-1.5 text-sm leading-relaxed">
        {teaser ||
          "Requires custom UX/copywriting redesign. We have prepared a mock-up template for this."}
      </p>
      <Button
        asChild
        size="sm"
        className="mt-3 bg-amber-500 text-white hover:bg-amber-600"
      >
        <Link href={config.bookCallUrl} target="_blank" rel="noopener noreferrer">
          <CalendarClock className="h-4 w-4" />
          Fix My Page
        </Link>
      </Button>
    </div>
  );
}

function Detail({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Info;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-xl bg-muted/40 p-3.5">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      <p className="mt-1.5 text-sm leading-relaxed">{text}</p>
    </div>
  );
}
