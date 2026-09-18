import "server-only";

import nodemailer from "nodemailer";

// A thin wrapper around SMTP (nodemailer) that degrades gracefully when the
// SMTP credentials aren't configured (e.g. local dev) so callers can surface a
// clear "email not configured" state instead of throwing. Works with any SMTP
// provider (Gmail App Password, Brevo, Outlook, etc.) — no domain required.

export type SendResult = { ok: true } | { ok: false; reason: string };

function transport(): nodemailer.Transporter | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;

  const port = Number(process.env.SMTP_PORT ?? 587);
  // 465 = implicit TLS; 587 = STARTTLS. Allow an explicit override.
  const secure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === "true"
    : port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

function sender(): string {
  // Many providers (e.g. Gmail) require From to match the authenticated user,
  // so fall back to SMTP_USER when EMAIL_FROM isn't set.
  return process.env.EMAIL_FROM ?? process.env.SMTP_USER ?? "";
}

async function send(args: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendResult> {
  const mailer = transport();
  if (!mailer) return { ok: false, reason: "not_configured" };
  try {
    await mailer.sendMail({
      from: sender(),
      to: args.to,
      subject: args.subject,
      html: args.html,
    });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "send_failed",
    };
  }
}

function shell(inner: string): string {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#0b1b33">
    <div style="font-size:18px;font-weight:700;margin-bottom:24px">CRO Audit</div>
    ${inner}
    <hr style="border:none;border-top:1px solid #e6ebf2;margin:32px 0" />
    <p style="font-size:12px;color:#7a8aa0">You received this because you requested it from our CRO audit tool. If this wasn't you, you can ignore this email.</p>
  </div>`;
}

export function sendOtpEmail(to: string, code: string): Promise<SendResult> {
  const html = shell(`
    <p style="font-size:15px;line-height:1.6">Here's your verification code to unlock your full CRO report:</p>
    <div style="font-size:34px;font-weight:700;letter-spacing:10px;background:#fff6e6;border:1px solid #f5c368;border-radius:12px;padding:18px;text-align:center;margin:20px 0;color:#0b1b33">${code}</div>
    <p style="font-size:13px;color:#7a8aa0">This code expires in 10 minutes.</p>
  `);
  return send({ to, subject: `Your CRO Audit code: ${code}`, html });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: "#dc2626",
  HIGH: "#ea580c",
  MEDIUM: "#d97706",
  LOW: "#2563eb",
  INFO: "#64748b",
};

export function sendReportEmail(args: {
  to: string;
  host: string;
  score: number;
  summary: string;
  primaryBottleneck?: string;
  issues: {
    title: string;
    severity: string;
    category: string;
    description: string;
  }[];
  bookCallUrl: string;
  shareUrl?: string;
}): Promise<SendResult> {
  const host = escapeHtml(args.host);
  const summary = escapeHtml(args.summary);
  const bottleneck = args.primaryBottleneck
    ? escapeHtml(args.primaryBottleneck)
    : "";
  const bookCallUrl = escapeHtml(args.bookCallUrl);
  const shareUrl = args.shareUrl ? escapeHtml(args.shareUrl) : "";

  const issueBlocks = args.issues
    .map((issue) => {
      const color = SEVERITY_COLOR[issue.severity] ?? "#64748b";
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e6ebf2;border-radius:12px;margin:0 0 12px">
        <tr>
          <td style="padding:14px 16px">
            <div style="font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${color};margin-bottom:6px">${escapeHtml(issue.severity)} · ${escapeHtml(issue.category)}</div>
            <div style="font-size:15px;font-weight:650;margin-bottom:6px">${escapeHtml(issue.title)}</div>
            <div style="font-size:13px;line-height:1.55;color:#3d4f66">${escapeHtml(issue.description)}</div>
          </td>
        </tr>
      </table>`;
    })
    .join("");

  const html = shell(`
    <p style="font-size:15px;line-height:1.6">Your CRO report for <strong>${host}</strong> is ready.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e6ebf2;border-radius:12px;margin:20px 0">
      <tr>
        <td style="padding:20px">
          <div style="font-size:13px;color:#7a8aa0">Overall conversion score</div>
          <div style="font-size:40px;font-weight:700;color:#0b1b33">${args.score}<span style="font-size:16px;color:#7a8aa0">/100</span></div>
        </td>
      </tr>
    </table>
    <p style="font-size:15px;line-height:1.6">${summary}</p>
    ${
      bottleneck
        ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff6e6;border:1px solid #f5c368;border-radius:12px;margin:20px 0">
      <tr>
        <td style="padding:16px">
          <div style="font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#9a6b12;margin-bottom:6px">Primary bottleneck</div>
          <div style="font-size:15px;line-height:1.55">${bottleneck}</div>
        </td>
      </tr>
    </table>`
        : ""
    }
    ${
      issueBlocks
        ? `<div style="font-size:13px;font-weight:700;margin:24px 0 10px;color:#0b1b33">Top issues</div>${issueBlocks}`
        : ""
    }
    <a href="${bookCallUrl}" style="display:inline-block;background:linear-gradient(90deg,#f5a623,#f59e0b);color:#0b1b33;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:9999px;margin-top:8px">Book a call to fix this page</a>
    ${
      shareUrl
        ? `<p style="font-size:13px;color:#7a8aa0;margin-top:16px">Open the interactive report: <br /><a href="${shareUrl}" style="color:#0b1b33">${shareUrl}</a></p>`
        : ""
    }
  `);
  return send({
    to: args.to,
    subject: `Your CRO report for ${args.host} (score ${args.score}/100)`,
    html,
  });
}
