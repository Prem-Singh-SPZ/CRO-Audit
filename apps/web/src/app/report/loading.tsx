// Shown during navigation to the report route (before the client component
// hydrates and reads the stored report). A lightweight skeleton keeps the
// transition from flashing a blank screen.
export default function ReportLoading() {
  return (
    <div className="min-h-screen">
      <div className="border-b bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="h-5 w-40 animate-pulse rounded bg-muted" />
          <div className="h-8 w-28 animate-pulse rounded-full bg-muted" />
        </div>
      </div>

      <main className="container mt-10 space-y-10">
        <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
          <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border p-8">
            <div className="h-40 w-40 animate-pulse rounded-full bg-muted" />
            <div className="h-6 w-24 animate-pulse rounded-full bg-muted" />
          </div>
          <div className="space-y-4 rounded-2xl border p-8">
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-7 w-52 animate-pulse rounded bg-muted" />
            <div className="space-y-2">
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
              <div className="h-4 w-11/12 animate-pulse rounded bg-muted" />
              <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl border bg-muted/40" />
          ))}
        </div>

        <div className="h-96 animate-pulse rounded-2xl border bg-muted/40" />
      </main>
    </div>
  );
}
