"use client";

import * as React from "react";
import { Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmailGateModal } from "./email-gate-modal";
import {
  getVerification,
  setVerification as persistVerification,
} from "@/lib/verification";

interface GateContextValue {
  verified: boolean;
  token: string | null;
  email: string | null;
  openGate: () => void;
}

const GateContext = React.createContext<GateContextValue | null>(null);

export function useReportGate(): GateContextValue {
  const ctx = React.useContext(GateContext);
  if (!ctx) throw new Error("useReportGate must be used within ReportGateProvider");
  return ctx;
}

export function ReportGateProvider({
  issueCount,
  readOnly = false,
  children,
}: {
  issueCount: number;
  // Shared/read-only reports are already "unlocked" — the owner chose to share.
  readOnly?: boolean;
  children: React.ReactNode;
}) {
  const [modalOpen, setModalOpen] = React.useState(false);
  const [token, setToken] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState<string | null>(null);

  React.useEffect(() => {
    const existing = getVerification();
    if (existing) {
      setToken(existing.token);
      setEmail(existing.email);
    }
  }, []);

  const verified = readOnly || token != null;

  const value = React.useMemo<GateContextValue>(
    () => ({
      verified,
      token,
      email,
      openGate: () => setModalOpen(true),
    }),
    [verified, token, email]
  );

  return (
    <GateContext.Provider value={value}>
      {children}
      <EmailGateModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        issueCount={issueCount}
        onVerified={(t, e) => {
          setToken(t);
          setEmail(e);
          persistVerification(t, e);
          setModalOpen(false);
        }}
      />
    </GateContext.Provider>
  );
}

/**
 * Wraps gated report content. When the visitor hasn't verified their email the
 * children are blurred + non-interactive and a lock overlay invites them to
 * unlock. Once verified, the children render normally.
 */
export function Locked({
  children,
  title = "Unlock the full report",
  description,
}: {
  children: React.ReactNode;
  title?: string;
  description?: string;
}) {
  const { verified, openGate } = useReportGate();

  if (verified) return <>{children}</>;

  return (
    <div className="relative">
      <div
        className="pointer-events-none select-none blur-sm [mask-image:linear-gradient(to_bottom,black,black_30%,transparent)]"
        aria-hidden="true"
      >
        {children}
      </div>
      <div className="absolute inset-0 flex items-start justify-center pt-16">
        <div className="mx-4 max-w-md rounded-3xl border bg-card/95 p-8 text-center shadow-2xl backdrop-blur">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Lock className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">{title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {description ??
              "Verify your email to reveal every issue, prioritized experiments, and before/after fixes. It's free."}
          </p>
          <Button
            variant="gradient"
            size="lg"
            onClick={openGate}
            className="mt-5 w-full"
          >
            Enter your email to unlock
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">
            No signup · one 6-digit code · no spam
          </p>
        </div>
      </div>
    </div>
  );
}
