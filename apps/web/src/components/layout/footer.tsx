import Link from "next/link";
import { Mail, Phone, MapPin, Linkedin } from "lucide-react";
import { Logo } from "@/components/logo";
import { config } from "@/lib/config";

export function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="container py-14">
        <div className="grid gap-10 md:grid-cols-[2fr_1.2fr]">
          <div className="max-w-md">
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
            <h4 className="text-sm font-semibold">Get in touch</h4>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
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
        </div>
      </div>
    </footer>
  );
}
