import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Hero } from "@/components/landing/hero";
import { TrustedBy } from "@/components/landing/trusted-by";
import { Stats } from "@/components/landing/stats";
import { Features } from "@/components/landing/features";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Testimonials } from "@/components/landing/testimonials";
import { AgencyCta } from "@/components/report/agency-cta";
import { FloatingContact } from "@/components/contact/floating-contact";
import { config } from "@/lib/config";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main id="main-content" tabIndex={-1}>
        <Hero />
        <TrustedBy />
        <HowItWorks />
        <Features />
        <Stats />
        <Testimonials />
        <section className="py-24">
          <div className="container">
            <AgencyCta
              context={{ source: "landing" }}
              title="Ready to grow your conversions?"
              description={`${config.brandName} turns this audit into a 30% lift in 90 days — no fee until we deliver.`}
            />
          </div>
        </section>
      </main>
      <Footer />
      <FloatingContact context={{ source: "landing" }} />
    </>
  );
}
