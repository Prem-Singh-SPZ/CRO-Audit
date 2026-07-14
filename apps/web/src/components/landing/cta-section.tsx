import { Reveal } from "@/components/reveal";
import { UrlAnalyzerForm } from "@/components/url-analyzer-form";

export function CtaSection() {
  return (
    <section className="py-24">
      <div className="container">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/10 via-background to-brand/10 p-10 text-center sm:p-16">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-grid-pattern bg-[size:36px_36px] opacity-[0.12] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
            <h2 className="mx-auto max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Ready to find out why your website isn&apos;t converting?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
              Run your free CRO audit now. No signup required.
            </p>
            <div className="mt-10 flex justify-center">
              <UrlAnalyzerForm />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
