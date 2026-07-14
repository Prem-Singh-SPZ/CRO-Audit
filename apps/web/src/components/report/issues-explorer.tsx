"use client";

import * as React from "react";
import { Search } from "lucide-react";

import { SEVERITIES, type SeverityLevel } from "@/lib/cro";
import type { IssueDto } from "@/lib/types";
import { SEVERITY_META } from "@/lib/report-ui";
import { IssueCard } from "./issue-card";
import { cn } from "@/lib/utils";

export function IssuesExplorer({ issues }: { issues: IssueDto[] }) {
  const [query, setQuery] = React.useState("");
  const [severity, setSeverity] = React.useState<SeverityLevel | "ALL">("ALL");
  const [category, setCategory] = React.useState<string>("ALL");

  const categories = React.useMemo(
    () => ["ALL", ...Array.from(new Set(issues.map((i) => i.category)))],
    [issues]
  );

  const filtered = React.useMemo(() => {
    return issues
      .filter((i) => (severity === "ALL" ? true : i.severity === severity))
      .filter((i) => (category === "ALL" ? true : i.category === category))
      .filter((i) =>
        query.trim()
          ? (i.title + i.description + i.category)
              .toLowerCase()
              .includes(query.toLowerCase())
          : true
      )
      .sort(
        (a, b) => SEVERITY_META[a.severity].order - SEVERITY_META[b.severity].order
      );
  }, [issues, severity, category, query]);

  return (
    <div>
      <div className="mb-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search issues..."
            className="h-11 w-full rounded-xl border bg-background pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            active={severity === "ALL"}
            onClick={() => setSeverity("ALL")}
          >
            All severities
          </FilterChip>
          {SEVERITIES.map((s) => (
            <FilterChip
              key={s}
              active={severity === s}
              onClick={() => setSeverity(s)}
            >
              <span className={cn("h-2 w-2 rounded-full", SEVERITY_META[s].dot)} />
              {SEVERITY_META[s].label}
            </FilterChip>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {categories.map((c) => (
            <FilterChip
              key={c}
              active={category === c}
              onClick={() => setCategory(c)}
            >
              {c === "ALL" ? "All categories" : c}
            </FilterChip>
          ))}
        </div>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        Showing {filtered.length} of {issues.length} issues
      </p>

      <div className="space-y-3">
        {filtered.map((issue) => (
          <IssueCard key={issue.id} issue={issue} />
        ))}
        {filtered.length === 0 && (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            No issues match your filters.
          </div>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "bg-background text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
