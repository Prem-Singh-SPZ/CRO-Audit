import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Hero } from "@/components/landing/hero";
import { Stats } from "@/components/landing/stats";
import { Features } from "@/components/landing/features";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Benefits } from "@/components/landing/benefits";
import { Testimonials } from "@/components/landing/testimonials";
import { CtaSection } from "@/components/landing/cta-section";
import { AgencyCta } from "@/components/report/agency-cta";
import { FloatingContact } from "@/components/contact/floating-contact";
import { config } from "@/lib/config";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <HowItWorks />
        <Stats />
        <Features />
        <Benefits />
        <Testimonials />
        <CtaSection />
        <section className="pb-24">
          <div className="container">
            <AgencyCta
              context={{ source: "landing" }}
              title="Ready to grow your conversions?"
              description={`${config.brandName} turns audits like this into measurable conversion lifts — 30% guaranteed in 90 days, with no fee until we deliver. Book a free demo and we'll map out your biggest opportunities.`}
            />
          </div>
        </section>
      </main>
      <Footer />
      <FloatingContact context={{ source: "landing" }} />
    </>
  );
}
