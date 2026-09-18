import type { CompetitorCompareDto } from "@cro/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function CompetitorCompare({
  compare,
}: {
  compare: CompetitorCompareDto;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>You vs {compare.competitorHost}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {compare.dimensions.map((d) => (
          <div key={d.key} className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 font-medium">{d.label}</span>
            <div className="flex items-center gap-2 tabular-nums">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-semibold",
                  d.you >= d.them
                    ? "bg-success/10 text-success"
                    : "bg-muted text-muted-foreground"
                )}
              >
                You {d.you}
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-semibold",
                  d.them > d.you
                    ? "bg-destructive/10 text-destructive"
                    : "bg-muted text-muted-foreground"
                )}
              >
                Them {d.them}
              </span>
            </div>
          </div>
        ))}
        <p className="border-t pt-3 text-sm leading-relaxed text-foreground/90">
          <span className="font-semibold text-primary">Top gap: </span>
          {compare.topGap}
        </p>
      </CardContent>
    </Card>
  );
}
