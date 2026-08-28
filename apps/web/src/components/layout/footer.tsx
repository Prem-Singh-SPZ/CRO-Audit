import Link from "next/link";
import { Mail, Phone, MapPin, Linkedin, ArrowRight } from "lucide-react";
import { Logo } from "@/components/logo";
import { config } from "@/lib/config";

const PRODUCT_LINKS = [
  { href: "/#analyze", label: "Run an audit" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#features", label: "Features" },
  { href: "/#testimonials", label: "Client results" },
];

const COMPANY_LINKS = [
  { href: config.bookCallUrl, label: "Get a demo", external: true },
  { href: config.contactUrl, label: "Contact us" },
  { href: config.linkedinUrl, label: "LinkedIn", external: true },
];

export function Footer() {
  return (
    <footer className="relative overflow-hidden border-t bg-muted/30">
      {/* Subtle amber glow along the top edge */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 h-48 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.12),transparent_70%)]"
      />
      <div className="container relative py-14">
        <div className="grid gap-10 md:grid-cols-[1.6fr_1fr_1fr_1.4fr]">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {config.footerDescription}
            </p>
            <Link
              href={config.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${config.company} on LinkedIn`}
              className="mt-5 inline-flex h-9 w-9 items-center justify-center rounded-full border text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              <Linkedin className="h-4 w-4" />
            </Link>
          </div>

          <div>
            <h4 className="text-sm font-semibold">Product</h4>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold">Company</h4>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              {COMPANY_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noopener noreferrer" : undefined}
                    className="transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold">Get CRO tips &amp; updates</h4>
            <form
              action={config.contactUrl}
              method="get"
              className="mt-4 flex items-center gap-2 rounded-full border bg-background p-1.5 shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"
            >
              <input
                type="email"
                name="subject"
                placeholder="you@company.com"
                aria-label="Email address"
                className="h-9 w-full bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                aria-label="Subscribe"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-primary to-amber-500 text-primary-foreground transition-transform hover:scale-105"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <ul className="mt-5 space-y-3 text-sm text-muted-foreground">
              <li>
                <Link
                  href={config.contactUrl}
                  className="inline-flex items-center gap-2 transition-colors hover:text-foreground"
                >
                  <Mail className="h-4 w-4 text-primary" />
                  {config.contactEmail}
                </Link>
              </li>
              <li>
                <Link
                  href={config.phoneHref}
                  className="inline-flex items-center gap-2 transition-colors hover:text-foreground"
                >
                  <Phone className="h-4 w-4 text-primary" />
                  {config.phone}
                </Link>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  {config.address.line1}
                  <br />
                  {config.address.city}
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t pt-8 text-sm text-muted-foreground sm:flex-row">
          <p>
            © {new Date().getFullYear()} {config.company}. All rights reserved.
          </p>
          <p className="text-xs">Predictive CRO · 30% lift guaranteed in 90 days</p>
        </div>
      </div>
    </footer>
  );
}
