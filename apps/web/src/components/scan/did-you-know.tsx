"use client";

import * as React from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { ChevronLeft, ChevronRight, Lightbulb, Pause } from "lucide-react";

import {
  pickCroFactsDeck,
  type CroFact,
  type CroFactVisual,
} from "@/lib/cro-facts";
import { cn } from "@/lib/utils";

const ROTATE_MS = 7000;
const SWIPE_PX = 80;

const slide = {
  enter: (dir: number) => ({ x: dir * 72, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -72, opacity: 0 }),
};

export function DidYouKnow({ paused = false }: { paused?: boolean }) {
  const [deck] = React.useState(() => pickCroFactsDeck());
  const [index, setIndex] = React.useState(0);
  const [direction, setDirection] = React.useState(1);
  const [token, setToken] = React.useState(0);
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const go = React.useCallback(
    (next: number, dir: number, manual = false) => {
      setDirection(dir);
      setIndex((next + deck.length) % deck.length);
      if (manual) setToken((t) => t + 1);
    },
    [deck.length]
  );

  React.useEffect(() => {
    if (paused || reduced || deck.length < 2) return;
    const id = window.setInterval(() => {
      setDirection(1);
      setIndex((i) => (i + 1) % deck.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [paused, reduced, deck.length, token]);

  function onDragEnd(_: unknown, info: PanInfo) {
    if (reduced || paused) return;
    if (info.offset.x < -SWIPE_PX) go(index + 1, 1, true);
    else if (info.offset.x > SWIPE_PX) go(index - 1, -1, true);
  }

  const fact = deck[index] ?? deck[0];
  if (!fact) return null;

  return (
    <aside
      className="relative flex min-h-[32rem] flex-col overflow-hidden border-t border-[#e8e2d8] bg-[#faf8f4] px-6 py-8 text-[#0f1c2e] lg:border-t-0 lg:border-l sm:px-10 sm:py-10 lg:min-h-screen lg:px-14 lg:py-12"
      aria-live="polite"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 top-16 h-64 w-64 rounded-full bg-[#0f1c2e]/[0.04] blur-3xl"
      />

      <div className="relative flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-sm font-semibold">
          <Lightbulb className="h-4 w-4 text-primary" />
          Did you know?
        </span>
        {paused ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[#3d4f63]">
            <Pause className="h-3 w-3" />
            Report ready
          </span>
        ) : (
          <span className="text-xs font-medium text-[#3d4f63]">
            While you wait
          </span>
        )}
      </div>

      <div className="relative mt-6 flex-1">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={fact.id}
            custom={direction}
            variants={reduced ? undefined : slide}
            initial={reduced ? false : "enter"}
            animate="center"
            exit={reduced ? undefined : "exit"}
            transition={{ duration: 0.28, ease: "easeOut" }}
            drag={reduced || paused ? false : "x"}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            onDragEnd={onDragEnd}
            className="flex cursor-grab flex-col active:cursor-grabbing"
          >
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#3d4f63]">
              {fact.eyebrow}
            </p>
            <h2 className="mt-3 max-w-3xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              {fact.title}
            </h2>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-[#3d4f63] sm:text-lg">
              {fact.body}
            </p>
            <div className="mx-auto mt-6 w-full max-w-md overflow-hidden rounded-2xl border border-[#e8e2d8] shadow-sm">
              <FactVisual visual={fact.visual} fact={fact} />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="relative mt-8 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous tip"
            onClick={() => go(index - 1, -1, true)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition hover:scale-105"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Next tip"
            onClick={() => go(index + 1, 1, true)}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-md transition hover:scale-105"
          >
            Swipe
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <span className="text-xs font-semibold tabular-nums text-[#3d4f63]">
          {index + 1} / {deck.length}
        </span>
        <div className="flex items-center gap-1.5">
          {deck.map((item, i) => (
            <button
              key={item.id}
              type="button"
              aria-label={`Show tip ${i + 1}`}
              aria-current={i === index ? true : undefined}
              onClick={() => go(i, i > index ? 1 : -1, true)}
              className={cn(
                "h-2 rounded-full transition-all",
                i === index
                  ? "w-6 bg-primary"
                  : "w-2 bg-[#0f1c2e]/20 hover:bg-[#0f1c2e]/40"
              )}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}

function FactVisual({
  visual,
  fact,
}: {
  visual: CroFactVisual;
  fact: CroFact;
}) {
  return (
    <div
      className="relative h-80 min-h-[20rem] bg-[#071428] p-4 text-card-foreground"
      role="img"
      aria-label={`Example: ${fact.title}`}
    >
      {visual === "cta" ? <CtaScene /> : null}
      {visual === "form" ? <FormScene /> : null}
      {visual === "social" ? <SocialScene /> : null}
      {visual === "speed" ? <SpeedScene /> : null}
      {visual === "headline" ? <HeadlineScene /> : null}
      {visual === "trust" ? <TrustScene /> : null}
      {visual === "urgency" ? <UrgencyScene /> : null}
      {visual === "contrast" ? <ContrastScene /> : null}
      {visual === "mobile" ? <MobileScene /> : null}
      {visual === "whitespace" ? <WhitespaceScene /> : null}
      {visual === "benefits" ? <BenefitsScene /> : null}
      {visual === "video" ? <VideoScene /> : null}
    </div>
  );
}

function MiniChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0c1a33]">
      <div className="flex items-center gap-1 border-b border-white/10 bg-white/5 px-2.5 py-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-white/35" />
        <span className="h-1.5 w-1.5 rounded-full bg-white/35" />
        <span className="h-1.5 w-1.5 rounded-full bg-white/35" />
      </div>
      <div className="flex flex-1 items-center justify-center p-3">{children}</div>
    </div>
  );
}

function CtaScene() {
  return (
    <div className="grid h-full grid-cols-2 gap-3">
      <MiniChrome>
        <div className="w-full space-y-2 text-center">
          <div className="mx-auto h-2.5 w-2/3 rounded bg-white/15" />
          <div className="mx-auto h-2 w-full rounded bg-white/10" />
          <p className="text-[11px] text-white/50 underline">learn more</p>
          <span className="block text-[10px] font-medium text-red-400">Too shy</span>
        </div>
      </MiniChrome>
      <MiniChrome>
        <div className="w-full space-y-2 text-center">
          <div className="mx-auto h-2.5 w-2/3 rounded bg-white/15" />
          <div className="mx-auto h-2 w-full rounded bg-white/10" />
          <div className="mx-auto h-8 w-24 rounded-md bg-primary text-[11px] font-bold leading-8 text-primary-foreground">
            Fix My Page
          </div>
          <span className="block text-[10px] font-medium text-emerald-400">
            Looks clickable
          </span>
        </div>
      </MiniChrome>
    </div>
  );
}

function FormScene() {
  return (
    <div className="grid h-full grid-cols-2 gap-3">
      <MiniChrome>
        <div className="w-full space-y-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-3 rounded border border-white/10 bg-white/10" />
          ))}
          <p className="pt-1 text-center text-[10px] text-red-400">Homework</p>
        </div>
      </MiniChrome>
      <MiniChrome>
        <div className="w-full space-y-2">
          <div className="h-4 rounded border border-white/10 bg-white/10" />
          <div className="h-4 rounded border border-white/10 bg-white/10" />
          <div className="h-7 rounded-md bg-primary/90" />
          <p className="text-center text-[10px] font-medium text-emerald-400">
            Three fields, done
          </p>
        </div>
      </MiniChrome>
    </div>
  );
}

function SocialScene() {
  return (
    <MiniChrome>
      <div className="flex w-full items-center gap-4">
        <div className="flex -space-x-2">
          {["bg-primary", "bg-emerald-400", "bg-sky-400"].map((c) => (
            <span
              key={c}
              className={cn("h-10 w-10 rounded-full border-2 border-[#0c1a33]", c)}
            />
          ))}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="text-sm text-primary">★★★★★</div>
          <p className="truncate text-sm text-white/70">
            “We booked 3 demos the first week.” — Maya
          </p>
        </div>
      </div>
    </MiniChrome>
  );
}

function SpeedScene() {
  return (
    <div className="grid h-full grid-cols-2 gap-3">
      <MiniChrome>
        <div className="w-full space-y-2">
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-1/5 rounded-full bg-red-400" />
          </div>
          <p className="text-center text-xs text-white/60">8.4s hero</p>
          <p className="text-center text-[11px] text-red-400">Bye</p>
        </div>
      </MiniChrome>
      <MiniChrome>
        <div className="w-full space-y-2">
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-4/5 rounded-full bg-emerald-400" />
          </div>
          <p className="text-center text-xs text-white/60">1.2s hero</p>
          <p className="text-center text-[11px] font-medium text-emerald-400">Stay</p>
        </div>
      </MiniChrome>
    </div>
  );
}

function HeadlineScene() {
  return (
    <div className="grid h-full grid-cols-2 gap-3">
      <MiniChrome>
        <div className="w-full space-y-2 text-center">
          <p className="text-sm font-semibold text-white/45">Welcome to our site</p>
          <div className="mx-auto h-2 w-3/4 rounded bg-white/10" />
          <p className="text-[11px] text-red-400">Vague wave</p>
        </div>
      </MiniChrome>
      <MiniChrome>
        <div className="w-full space-y-2 text-center">
          <p className="text-sm font-semibold leading-tight text-white">
            Book more demos this week
          </p>
          <div className="mx-auto h-7 w-20 rounded-md bg-primary" />
          <p className="text-[11px] font-medium text-emerald-400">A real offer</p>
        </div>
      </MiniChrome>
    </div>
  );
}

function TrustScene() {
  return (
    <MiniChrome>
      <div className="grid w-full grid-cols-4 gap-2">
        {["Visa", "G2", "SOC2", "???"].map((label, i) => (
          <div
            key={label}
            className={cn(
              "flex h-14 items-center justify-center rounded-md border text-[11px] font-semibold",
              i === 3
                ? "border-dashed border-white/20 text-white/30"
                : "border-white/10 bg-white/10 text-white/80"
            )}
          >
            {label}
          </div>
        ))}
      </div>
    </MiniChrome>
  );
}

function UrgencyScene() {
  return (
    <MiniChrome>
      <div className="w-full text-center">
        <p className="text-xs font-medium text-white/60">Sale ends in</p>
        <div className="mt-2 flex justify-center gap-1.5">
          {["00", "14", "??"].map((n, i) => (
            <span
              key={`${n}-${i}`}
              className={cn(
                "rounded-md px-2.5 py-1.5 font-mono text-sm font-bold",
                i === 2 ? "bg-red-400/20 text-red-400" : "bg-white/10 text-white"
              )}
            >
              {n}
            </span>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-red-400">
          Resets when you refresh. Suspicious.
        </p>
      </div>
    </MiniChrome>
  );
}

function ContrastScene() {
  return (
    <div className="grid h-full grid-cols-2 gap-3">
      <MiniChrome>
        <div className="w-full space-y-2 text-center">
          <div className="mx-auto h-2.5 w-2/3 rounded bg-white/15" />
          <div className="mx-auto h-8 w-24 rounded-md bg-white/10 text-[11px] leading-8 text-white/35">
            Continue
          </div>
          <p className="text-[11px] text-red-400">Camouflage</p>
        </div>
      </MiniChrome>
      <MiniChrome>
        <div className="w-full space-y-2 text-center">
          <div className="mx-auto h-2.5 w-2/3 rounded bg-white/15" />
          <div className="mx-auto h-8 w-24 rounded-md bg-primary text-[11px] font-bold leading-8 text-primary-foreground">
            Continue
          </div>
          <p className="text-[11px] font-medium text-emerald-400">Can’t miss it</p>
        </div>
      </MiniChrome>
    </div>
  );
}

function MobileScene() {
  return (
    <div className="flex h-full items-center justify-center gap-5">
      <div className="flex h-full w-20 flex-col overflow-hidden rounded-2xl border-2 border-white/20 bg-[#071428]">
        <div className="mx-auto mt-1.5 h-1 w-8 rounded-full bg-white/25" />
        <div className="flex flex-1 flex-col items-center justify-end gap-1.5 p-2">
          <div className="h-7 w-full rounded-md bg-primary text-center text-[10px] font-bold leading-7 text-primary-foreground">
            Get demo
          </div>
          <p className="text-[10px] text-emerald-400">Thumb-friendly</p>
        </div>
      </div>
      <p className="max-w-[12rem] text-sm leading-snug text-white/70">
        Tiny links next to the form are how people accidentally leave.
      </p>
    </div>
  );
}

function WhitespaceScene() {
  return (
    <div className="grid h-full grid-cols-2 gap-3">
      <MiniChrome>
        <div className="grid w-full grid-cols-3 gap-1">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-7 rounded bg-white/15" />
          ))}
        </div>
      </MiniChrome>
      <MiniChrome>
        <div className="w-full space-y-3 px-3 text-center">
          <div className="mx-auto h-2.5 w-1/2 rounded bg-white/15" />
          <div className="mx-auto h-7 w-20 rounded-md bg-primary" />
        </div>
      </MiniChrome>
    </div>
  );
}

function BenefitsScene() {
  return (
    <div className="grid h-full grid-cols-2 gap-3">
      <MiniChrome>
        <ul className="w-full space-y-1.5 text-xs text-white/45">
          <li>• AI-powered</li>
          <li>• Next-gen</li>
          <li>• Synergistic</li>
        </ul>
      </MiniChrome>
      <MiniChrome>
        <ul className="w-full space-y-1.5 text-xs text-white">
          <li className="flex items-center gap-1.5">
            <span className="text-emerald-400">✓</span> See the leaks
          </li>
          <li className="flex items-center gap-1.5">
            <span className="text-emerald-400">✓</span> Fix in a week
          </li>
          <li className="flex items-center gap-1.5">
            <span className="text-emerald-400">✓</span> Book more calls
          </li>
        </ul>
      </MiniChrome>
    </div>
  );
}

function VideoScene() {
  return (
    <MiniChrome>
      <div className="relative flex h-full w-full items-center justify-center rounded-md bg-white/5">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
          ▶
        </span>
        <span className="absolute right-2 top-2 rounded bg-red-500 px-2 py-0.5 text-[10px] font-semibold text-white">
          SOUND ON
        </span>
      </div>
    </MiniChrome>
  );
}
