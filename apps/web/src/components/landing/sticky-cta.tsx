"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useScroll, useMotionValueEvent } from "framer-motion";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

export function StickyCta() {
  const [visible, setVisible] = React.useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    // Show after scrolling past the hero, hide near the very top.
    setVisible(latest > 700);
  });

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
          className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 md:hidden"
        >
          <div className="glass-strong flex w-full max-w-md items-center justify-between gap-3 rounded-2xl p-2.5 pl-4 shadow-xl">
            <span className="text-sm font-medium">Get your free CRO audit</span>
            <Button asChild variant="gradient" size="sm">
              <Link href="/#analyze">
                <Sparkles className="h-4 w-4" />
                Analyze
              </Link>
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
