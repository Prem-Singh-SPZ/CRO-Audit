"use client";

import * as React from "react";
import { motion, type Variants } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1] as const;

export type RevealVariant = "fade-up" | "scale-in" | "blur-in" | "fade";

function buildVariants(variant: RevealVariant): Variants {
  const hidden: Record<RevealVariant, Record<string, number>> = {
    "fade-up": { opacity: 0, y: 24 },
    "scale-in": { opacity: 0, scale: 0.94 },
    "blur-in": { opacity: 0, y: 16 },
    fade: { opacity: 0 },
  };
  return {
    hidden: {
      ...hidden[variant],
      ...(variant === "blur-in" ? { filter: "blur(10px)" } : {}),
    },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      ...(variant === "blur-in" ? { filter: "blur(0px)" } : {}),
      transition: { duration: 0.6, delay: i * 0.08, ease: EASE },
    }),
  };
}

export function Reveal({
  children,
  delay = 0,
  variant = "fade-up",
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  variant?: RevealVariant;
  className?: string;
}) {
  const variants = React.useMemo(() => buildVariants(variant), [variant]);
  return (
    <motion.div
      className={className}
      custom={delay}
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
    >
      {children}
    </motion.div>
  );
}

const containerVariants: Variants = {
  hidden: {},
  visible: (stagger: number) => ({
    transition: { staggerChildren: stagger, delayChildren: 0.05 },
  }),
};

/**
 * Wrap a list of `StaggerItem`s to choreograph their entrance in sequence as
 * the group scrolls into view.
 */
export function Stagger({
  children,
  stagger = 0.08,
  className,
}: {
  children: React.ReactNode;
  stagger?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      custom={stagger}
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
    >
      {children}
    </motion.div>
  );
}

const itemVariants: Record<RevealVariant, Variants> = {
  "fade-up": {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
  },
  "scale-in": {
    hidden: { opacity: 0, scale: 0.94 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.55, ease: EASE } },
  },
  "blur-in": {
    hidden: { opacity: 0, y: 14, filter: "blur(8px)" },
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { duration: 0.55, ease: EASE },
    },
  },
  fade: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.55, ease: EASE } },
  },
};

export function StaggerItem({
  children,
  variant = "fade-up",
  className,
}: {
  children: React.ReactNode;
  variant?: RevealVariant;
  className?: string;
}) {
  return (
    <motion.div className={className} variants={itemVariants[variant]}>
      {children}
    </motion.div>
  );
}
