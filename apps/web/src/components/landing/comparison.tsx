import { Check, X } from "lucide-react";

import { Reveal } from "@/components/reveal";
import { config } from "@/lib/config";

type Cell = boolean | string;

const COLUMNS = ["DIY scanners", "Hiring a consultant", config.brandName] as const;

const ROWS: { feature: string; values: [Cell, Cell, Cell] }[] = [
  { feature: "Time to insight", values: ["Instant", "1–2 weeks", "Under 60s"] },
  { feature: "Cost", values: ["Low", "$$$$", "Free audit"] },
  { feature: "Expert CRO reasoning", values: [false, true, true] },
  { feature: "Conversion psychology analysis", values: [false, true, true] },
  { feature: "Prioritized by impact vs. effort", values: [false, true, true] },
  { feature: "Annotated full-page screenshots", values: [false, false, true] },
  { feature: "Before / after fix previews", values: [false, false, true] },
  { feature: "No signup to start", values: [true, false, true] },
];

export function Comparison() {
  return (
    <section className="py-24">
      <div className="container">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            Why it wins
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Expert insight without the agency wait
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            The depth of a senior CRO consultant, delivered at the speed of a
            scanner — and none of the guesswork.
          </p>
        </Reveal>

        <Reveal delay={1}>
          <div className="mx-auto mt-14 max-w-4xl overflow-hidden rounded-3xl border bg-card shadow-sm">
            <div className="grid grid-cols-[1.4fr_repeat(3,1fr)] text-sm">
              {/* Header row */}
              <div className="border-b bg-muted/40 p-4" />
              {COLUMNS.map((col, i) => (
                <div
                  key={col}
                  className={`border-b border-l p-4 text-center text-sm font-semibold ${
                    i === 2 ? "bg-primary/10 text-primary" : "bg-muted/40"
                  }`}
                >
                  {col}
                </div>
              ))}

              {/* Body rows */}
              {ROWS.map((row, r) => (
                <div key={row.feature} className="contents">
                  <div
                    className={`p-4 font-medium ${
                      r < ROWS.length - 1 ? "border-b" : ""
                    }`}
                  >
                    {row.feature}
                  </div>
                  {row.values.map((val, c) => (
                    <div
                      key={c}
                      className={`flex items-center justify-center border-l p-4 text-center ${
                        r < ROWS.length - 1 ? "border-b" : ""
                      } ${c === 2 ? "bg-primary/5" : ""}`}
                    >
                      <CellValue value={val} highlight={c === 2} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function CellValue({ value, highlight }: { value: Cell; highlight: boolean }) {
  if (typeof value === "string") {
    return (
      <span
        className={`text-sm ${
          highlight ? "font-semibold text-primary" : "text-muted-foreground"
        }`}
      >
        {value}
      </span>
    );
  }
  return value ? (
    <Check
      className={`h-5 w-5 ${highlight ? "text-primary" : "text-success"}`}
      aria-label="Yes"
    />
  ) : (
    <X className="h-5 w-5 text-muted-foreground/40" aria-label="No" />
  );
}
