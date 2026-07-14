import type { SeverityLevel } from "@/lib/cro";

export const SEVERITY_META: Record<
  SeverityLevel,
  { label: string; badge: string; dot: string; order: number }
> = {
  CRITICAL: {
    label: "Critical",
    badge: "bg-destructive text-destructive-foreground",
    dot: "bg-destructive",
    order: 0,
  },
  HIGH: {
    label: "High",
    badge: "bg-destructive/10 text-destructive",
    dot: "bg-destructive",
    order: 1,
  },
  MEDIUM: {
    label: "Medium",
    badge: "bg-warning/15 text-warning",
    dot: "bg-warning",
    order: 2,
  },
  LOW: {
    label: "Low",
    badge: "bg-primary/10 text-primary",
    dot: "bg-primary",
    order: 3,
  },
  INFO: {
    label: "Info",
    badge: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
    order: 4,
  },
};

export const PRIORITY_META: Record<
  "high" | "medium" | "low",
  { label: string; className: string }
> = {
  high: { label: "High priority", className: "bg-destructive/10 text-destructive" },
  medium: { label: "Medium priority", className: "bg-warning/15 text-warning" },
  low: { label: "Low priority", className: "bg-success/15 text-success" },
};
