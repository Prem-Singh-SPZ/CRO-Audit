"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, X, Calendar, Mail, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { config } from "@/lib/config";
import type { ContactContext } from "./types";

export function FloatingContact({ context }: { context?: ContactContext }) {
  const [expanded, setExpanded] = React.useState(false);
  const [showTeaser, setShowTeaser] = React.useState(false);
  const [teaserDismissed, setTeaserDismissed] = React.useState(false);

  // Copy adapts to context: a report shows "fix these issues", elsewhere
  // (e.g. the homepage) there are no issues yet, so we lead with growth.
  const isReport =
    context?.source === "report" || context?.source === "shared-report";
  const teaser = isReport
    ? {
        title: "Want us to fix these issues?",
        subtitle: "Get a tailored CRO plan from our team →",
      }
    : {
        title: "Want more conversions?",
        subtitle: "Talk to our CRO experts — it's free →",
      };
  const menuTitle = isReport ? "Get help fixing this" : "Talk to a CRO expert";

  // Nudge the user with a teaser bubble a few seconds after landing.
  React.useEffect(() => {
    const t = setTimeout(() => setShowTeaser(true), 3500);
    return () => clearTimeout(t);
  }, []);

  const hideTeaser = () => {
    setShowTeaser(false);
    setTeaserDismissed(true);
  };

  const openMenu = () => {
    hideTeaser();
    setExpanded(true);
  };

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3 print:hidden sm:bottom-6 sm:right-6">
      {/* Teaser bubble */}
      <AnimatePresence>
        {showTeaser && !expanded && !teaserDismissed ? (
          <motion.button
            type="button"
            onClick={openMenu}
            initial={{ opacity: 0, y: 12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className="glass-strong group relative max-w-[15rem] rounded-2xl rounded-br-sm p-3.5 pr-9 text-left shadow-xl"
          >
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                hideTeaser();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  hideTeaser();
                }
              }}
              className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground opacity-70 transition-opacity hover:opacity-100"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </span>
            <p className="text-sm font-semibold">{teaser.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {teaser.subtitle}
            </p>
          </motion.button>
        ) : null}
      </AnimatePresence>

      {/* Expanded quick actions */}
      <AnimatePresence>
        {expanded ? (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="glass-strong w-64 rounded-2xl p-3 shadow-2xl"
          >
            <div className="px-1.5 pb-2 pt-1">
              <p className="text-sm font-semibold">{menuTitle}</p>
              <p className="text-xs text-muted-foreground">
                Our CRO experts are ready.
              </p>
            </div>
            <div className="space-y-1.5">
              <Button asChild variant="gradient" className="w-full justify-start">
                <Link href={config.bookCallUrl} target="_blank">
                  <Calendar className="h-4 w-4" />
                  Get a demo
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href={config.contactUrl}>
                  <Mail className="h-4 w-4" />
                  {config.contactEmail}
                </Link>
              </Button>
              <Button asChild variant="ghost" className="w-full justify-start">
                <Link href={config.phoneHref}>
                  <Phone className="h-4 w-4" />
                  {config.phone}
                </Link>
              </Button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* FAB */}
      <button
        type="button"
        onClick={() => {
          hideTeaser();
          setExpanded((v) => !v);
        }}
        aria-label={expanded ? "Close contact menu" : "Contact us"}
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-primary to-amber-500 text-primary-foreground shadow-lg shadow-primary/40 transition-transform hover:scale-105 active:scale-95"
      >
        {!expanded && !teaserDismissed ? (
          <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-primary/40" />
        ) : null}
        <AnimatePresence mode="wait" initial={false}>
          {expanded ? (
            <motion.span
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X className="h-6 w-6" />
            </motion.span>
          ) : (
            <motion.span
              key="chat"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <MessageCircle className="h-6 w-6" />
            </motion.span>
          )}
        </AnimatePresence>
      </button>
    </div>
  );
}
