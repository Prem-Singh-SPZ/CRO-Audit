import { Reveal } from "@/components/reveal";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQS = [
  {
    q: "How long does an audit take?",
    a: "Usually under a minute. We fetch your page, capture mobile and desktop screenshots, run Google PageSpeed Insights, and generate the full CRO report automatically.",
  },
  {
    q: "Do I need to sign up?",
    a: "No. Just enter a URL and get your report instantly - no account, no credit card, no setup required.",
  },
  {
    q: "What does the audit actually analyze?",
    a: "Everything that affects conversions: hero and headline clarity, CTAs, trust signals and social proof, visual hierarchy, copywriting, forms, mobile UX, performance, accessibility, SEO basics, and persuasion psychology - grounded in frameworks like Nielsen, Baymard, CXL, and the Fogg Behavior Model.",
  },
  {
    q: "Is this just PageSpeed with extra steps?",
    a: "No. We use Google PageSpeed Insights for performance, accessibility, SEO, and best practices, then layer expert visual and CRO reasoning on top - explaining why each metric matters for conversions and what to do about it.",
  },
  {
    q: "Can I export the report?",
    a: "Yes. Export a polished PDF or download the raw JSON to share with your team or clients.",
  },
  {
    q: "Will this work on my ecommerce / SaaS / landing page?",
    a: "Yes. The audit adapts to SaaS, ecommerce, and landing-page best practices, so the recommendations are relevant to your business model.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="py-24">
      <div className="container max-w-3xl">
        <Reveal className="text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            FAQ
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Frequently asked questions
          </h2>
        </Reveal>

        <Reveal delay={1} className="mt-12">
          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((faq, i) => (
              <AccordionItem key={faq.q} value={`item-${i}`}>
                <AccordionTrigger>{faq.q}</AccordionTrigger>
                <AccordionContent>{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}
