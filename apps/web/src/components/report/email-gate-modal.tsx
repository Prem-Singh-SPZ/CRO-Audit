"use client";

import * as React from "react";
import { Loader2, Lock, MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const RESEND_SECONDS = 30;

export function EmailGateModal({
  open,
  onOpenChange,
  onVerified,
  issueCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: (token: string, email: string) => void;
  issueCount: number;
}) {
  const [step, setStep] = React.useState<"email" | "code">("email");
  const [email, setEmail] = React.useState("");
  const [requestId, setRequestId] = React.useState("");
  const [code, setCode] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [cooldown, setCooldown] = React.useState(0);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function requestCode(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Couldn't send the code.");
      setRequestId(data.requestId);
      setStep("code");
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function verify(e?: React.FormEvent) {
    e?.preventDefault();
    if (code.length !== 6) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, code, email: email.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "That code isn't right.");
      onVerified(data.token, data.email);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {step === "email" ? (
              <Lock className="h-5 w-5" />
            ) : (
              <MailCheck className="h-5 w-5" />
            )}
          </div>
          <DialogTitle>
            {step === "email"
              ? "Unlock your full CRO report"
              : "Enter your verification code"}
          </DialogTitle>
          <DialogDescription>
            {step === "email"
              ? `See all ${issueCount} issues, prioritized experiments, and before/after fixes. Enter your email and we'll send a 6-digit code.`
              : `We sent a 6-digit code to ${email}. Enter it below to unlock.`}
          </DialogDescription>
        </DialogHeader>

        {step === "email" ? (
          <form onSubmit={requestCode} className="space-y-3">
            <input
              type="email"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              aria-label="Email address"
              className="h-11 w-full rounded-xl border-2 border-primary/40 bg-background px-4 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            {error ? (
              <p className="text-sm font-medium text-destructive">{error}</p>
            ) : null}
            <Button
              type="submit"
              variant="gradient"
              size="lg"
              disabled={loading}
              className="w-full"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading ? "Sending code…" : "Send my code"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              We only use your email to send this report and CRO tips. No spam.
            </p>
          </form>
        ) : (
          <form onSubmit={verify} className="space-y-4">
            <OtpInput value={code} onChange={setCode} disabled={loading} />
            {error ? (
              <p className="text-sm font-medium text-destructive">{error}</p>
            ) : null}
            <Button
              type="submit"
              variant="gradient"
              size="lg"
              disabled={loading || code.length !== 6}
              className="w-full"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading ? "Verifying…" : "Unlock report"}
            </Button>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError(null);
                }}
                className="underline-offset-4 hover:text-foreground hover:underline"
              >
                Use a different email
              </button>
              <button
                type="button"
                disabled={cooldown > 0 || loading}
                onClick={() => requestCode()}
                className="underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50"
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function OtpInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const refs = React.useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "");

  function setAt(i: number, char: string) {
    const clean = char.replace(/\D/g, "");
    const next = digits.slice();
    next[i] = clean.slice(-1);
    const joined = next.join("").slice(0, 6);
    onChange(joined);
    if (clean && i < 5) refs.current[i + 1]?.focus();
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
  }

  function onPaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (text) {
      e.preventDefault();
      onChange(text);
      refs.current[Math.min(text.length, 5)]?.focus();
    }
  }

  return (
    <div className="flex justify-between gap-2" onPaste={onPaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          value={d}
          disabled={disabled}
          autoFocus={i === 0}
          onChange={(e) => setAt(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          className="h-14 w-full rounded-xl border-2 border-primary/40 bg-background text-center text-xl font-semibold outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
        />
      ))}
    </div>
  );
}
