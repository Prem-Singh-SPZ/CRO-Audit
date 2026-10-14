# CRO Audit AI — Stakeholder brief

**CRO Audit AI** is a Spiralyze lead-generation tool. A visitor pastes a website URL and, in a few minutes, gets a conversion audit: a score, what’s hurting sign-ups or bookings, issues marked on their real page, and a visual “after” of how that page could look. The goal is not only a report — it is to prove we understand their site, then route them to **book a call**.

There is no login. The report lives in the browser for that visit. Unlocking full detail with email keeps them unlocked for **7 days**. Verified emails (and optional “this finding is wrong” feedback) can be copied to a **Google Sheet** for marketing when that webhook is configured.

---

## What the visitor experiences

1. They land on our site and enter their URL.
2. We look at their live page (content, screenshot, performance signals).
3. They see an interactive report: score, problems, experiments to try, and a redesign concept.
4. Deeper detail is gated behind a 6-digit email code. They can email themselves a short HTML summary. Sales CTAs go to the Spiralyze book-a-call link.

The redesign image is generated **after** the report opens, so they are not stuck waiting for it before they can read findings. While it runs they see a progress bar and a short status message. If it takes longer than about half a minute, we reassure them that the concept is still coming.

---

## What the report shows

| Piece | What they see |
| --- | --- |
| **Score & summary** | Overall score, main bottleneck, and category strengths / weaknesses |
| **Your page** | Their real screenshot with numbered **pills** on measured elements (headline, form, button, etc.). Clicking a pill opens that finding |
| **If we redesigned it** | One or two AI “after” concepts. Form-heavy pages often get two layouts; marketing pages usually get one cleaner hero. They can switch between concepts when two exist |
| **Experiments** | Before / after ideas grouped by section, grounded in Spiralyze’s tested win patterns |
| **Performance** | Lighthouse-style scores when Google PageSpeed is available; otherwise a clear estimate from what we already know about the page |

**Special situations (same report, different banner):**

- **Live A/B test already running** — we treat that treatment carefully and do not call it a broken control.
- **Page hard to capture** — we still try to show a usable screenshot. If the fold never painted properly, they see an incomplete-capture message and we skip the redesign for that run.
- **Bot wall / blocked site** — we may retry through a residential browser, then an Internet Archive snapshot, or fall back to an honest rules-based report so we never pretend a security-check page is their real site.

---

## How we get smart answers (hybrid)

**In the local environment we are using Gemini only.**

| Source | Plain English |
| --- | --- |
| **Live page evidence** | Real HTML, a real screenshot, and performance signals for *this* URL |
| **Spiralyze rules engine** | Built-in CRO checks (weak CTAs, form friction, missing proof, etc.) that still work with zero AI keys |
| **Spiralyze win-pattern library** | Curated A/B winners (uplift, win rate, sample size) so recommended lifts and layouts are grounded in tests, not a guess |
| **Google Gemini (rented API)** | Richer written findings and the photorealistic redesign image |

**Right now we use Gemini.** Written audit and callout placement use **`gemini-3.1-pro-preview`**. The redesign image uses **`gemini-3-pro-image-preview`**. OpenAI and Anthropic are wired in the code but unused unless keys are added. If Gemini fails, the rules engine still produces a page-specific report. If the redesign image fails, the report can still show a simple concept on their live screenshot so the “after” tab is not empty.

Pills on **their** screenshot come from measuring the page in the browser when we can. If that measurement comes back empty, we locate the headline and primary button/form on the screenshot with the same kind of vision pass used for redesign callouts — we do not invent random positions.

---

## Performance scores (simple)

- With a working **Google PageSpeed** key → real Lighthouse numbers (mobile first).
- Without a key, or if PageSpeed fails → we estimate from crawl signals (load time, alt text, HTTPS, meta description / H1). Two metrics (CLS and Total Blocking Time) stay fixed placeholders. This is **not random**.

---

## Where it runs

| Piece | Host |
| --- | --- |
| Website (landing + report) | **Vercel** |
| Analysis API (screenshot + AI) | **Google Cloud Run** |
| Share links & email codes (optional / short-lived) | **Vercel Blob** |
| Lead list | **Google Sheet** (Apps Script webhook) when configured |

Repeat audits of the same URL can reuse a short in-memory cache when we turn that on. There is no customer database of our own.

For deploy steps see [`DEPLOYMENT.md`](DEPLOYMENT.md). For “why this stack” see [`TECH_STACK.md`](TECH_STACK.md).

---

## Under the hood (for technical readers)

Monorepo: `apps/web` (Next.js 14 + React 18), `apps/api` (Hono + Puppeteer / Chromium), `packages/shared` (Zod contracts). Node 20+.

| Job | Tool |
| --- | --- |
| HTML signals | cheerio |
| Screenshot & page measurement | puppeteer-core + Chromium (`@sparticuz/chromium` on Cloud Run) |
| Hard-capture retry | Bright Data Scraping Browser (only when the first capture would fail) |
| Archive fallback | Internet Archive CDX |
| Written audit / section fill-in / callout boxes | Gemini `gemini-3.1-pro-preview` |
| Redesign image | Gemini `gemini-3-pro-image-preview` (can disable with `ENABLE_FIX_MOCKUP=false`) |
| Fallback audit | `mock-ai.ts` rules engine |
| Email OTP & summary | nodemailer (SMTP) |
| UI | Tailwind, shadcn/ui, Framer Motion, Recharts |

Safety: URL SSRF guard, per-IP rate limits, CORS allowlist, scraped text sanitized before prompts, Chromium concurrency cap on Cloud Run.

---

## What this is *not*

It is not a CMS, not a full A/B testing platform, and not a customer database. It is a **self-serve diagnostic + sales teaser**: prove we understand their page, show a better version, and get them on a call.
