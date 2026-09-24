# CRO Audit AI — Stakeholder brief

**CRO Audit AI** is a lead-generation tool for Spiralyze. Someone pastes a website URL and gets a conversion audit in a few minutes: a score, what’s hurting sign-ups or bookings, and a visual “after” of how the page could look. The goal is not just a report — it is to show the problem, then route them to **book a call**.

---

## What it does

1. Visitor lands on the **Next.js** site (`apps/web`) and enters their URL.
2. The **Hono API** (`apps/api`) looks at the live page: **cheerio** reads the HTML, **Puppeteer** plus Chromium takes a real screenshot, and **Google PageSpeed Insights** supplies Lighthouse scores when a key is set.
3. We return an interactive report: overall score, issues pinned on their screenshot, recommended experiments, and one or two redesign concepts.
4. Full detail is gated behind a 6-digit email code sent by **nodemailer** (SMTP). They can email themselves an HTML summary. Sales CTAs go to the Spiralyze demo / book-a-call link (`NEXT_PUBLIC_BOOK_CALL_URL`).

There is no login. The on-screen report starts in the browser’s `sessionStorage`. A verified visitor stays unlocked for **7 days** in `localStorage`. Optional share links and the email code are stored in **Vercel Blob**. A verified email is also appended to a **Google Sheet** (Apps Script webhook) when that webhook is configured.

---

## How it works

Think of it as **look at the page → diagnose → show the fix**.

- **Look:** **Puppeteer** driving headless Chromium opens their site and takes a desktop screenshot (local Chrome via `CHROME_EXECUTABLE_PATH`; system Chromium on Cloud Run; **@sparticuz/chromium** is the serverless fallback). **cheerio** reads structure (headline, forms, buttons, proof). **Google PageSpeed Insights** returns Lighthouse performance, accessibility, SEO, and Core Web Vitals when `GOOGLE_PAGESPEED_API_KEY` works. If the key is missing or both the mobile and desktop calls fail, **`fallbackLighthouse`** (our formula in `pagespeed.ts`) fills the same slots from the crawl — it is not random. See [Performance scores without PageSpeed](#performance-scores-without-pagespeed).
- **If the live page is unusable:** **Puppeteer** still tries first. A bot wall, blank render, or failed capture is detected in code (`detectChallenge` / capture-quality checks). We then ask the **Internet Archive CDX API** (`web.archive.org`) for a snapshot and screenshot that instead. A URL that is already an archive link is captured as an archive on purpose. A blocked page that we cannot recover skips the vision model and uses the heuristic “blocked” report from **`mock-ai.ts`**.
- **If a live test is already running:** **Puppeteer** inspects the rendered DOM (`live-test.ts`) for Spiralyze / vendor experiment classes. When one is still active, **Gemini** is told to treat that treatment as the winner and not file it as a broken control.
- **Diagnose:** **Gemini `gemini-3.1-pro-preview`** (`AI_PROVIDER=gemini`, `GEMINI_MODEL`) reads the screenshot plus the page text and writes the audit. A second call to the **same Gemini model** (`applySectionCritic`) adds a flaw or a strength for any page section the first pass skipped. **Zod** rejects malformed JSON. If Gemini fails and no other provider key is set, **`mock-ai.ts`** (our rules engine) still produces a page-specific report. Recommended lifts come from the **Spiralyze win-pattern library** in `@cro/shared` (`win-patterns.ts`), not from a guessed percentage.
- **Show the fix:** **Gemini `gemini-3-pro-image-preview`** (`MOCKUP_MODEL`) draws the “With fixes” image. Form-heavy pages get **two** layouts chosen from that win-pattern library; other pages get **one** cleaner hero. Issues on the real screenshot are pinned by our **landmark measurement** in Puppeteer (`landmarks.ts`), not by the image model. Each redesign then gets its own boxes from a third **Gemini** call — `MOCKUP_LOCATE_MODEL` if set, otherwise **`gemini-3.1-pro-preview`** — which locates the headline, benefits, and button. Turn the whole mockup step off with `ENABLE_FIX_MOCKUP=false`.
- **Unlock and follow-up:** **nodemailer** sends the 6-digit code and, if they ask, a short HTML summary (score, bottleneck, top issues, book-a-call). The hashed code lives in **Vercel Blob** for 10 minutes. **Share** (optional, separate) uploads the report JSON to **Vercel Blob** via `@vercel/blob`. A **Vercel cron** (`/api/cron/cleanup-reports`, daily) deletes shared reports older than 30 days. “This finding is wrong” feedback from a verified visitor is appended to the same **Google Sheet** as the lead.

Repeat audits of the same URL can skip a full crawl when `ENABLE_RESULT_CACHE=true`. That cache is in-memory on the API instance and is off unless we turn it on.

---

## Performance scores without PageSpeed

**Not random.** With no `GOOGLE_PAGESPEED_API_KEY`, or when PageSpeed fails, **`fallbackLighthouse`** estimates the four scores from signals **cheerio** already collected:

| Shown number | How it is estimated |
| --- | --- |
| Performance | Starts at 92 and drops as the crawl’s load time passes 1.5s. Floor is 30. |
| Accessibility | 60–90 from how many images have alt text. |
| Best practices | 83 on HTTPS, otherwise 62. |
| SEO | About 65–90 from whether a meta description and an H1 exist. |
| LCP, FCP, Speed Index, TTI | Scaled from that same crawl load time. |
| CLS and Total Blocking Time | Fixed placeholders: **0.05** and **120**. Those two are not measured. |

Locally `GOOGLE_PAGESPEED_API_KEY` is empty, so this machine uses that estimate. Cloud Run may still have the real key; that setting is not in the repo. With a working key, the numbers are **Google PageSpeed Insights** (Lighthouse), mobile first, desktop only if mobile fails.

---

## Are we using our own learning, AI, or both?

**Both — and we do not train our own AI model.**

Results are a **hybrid** of four things:

| Source | What it is | What it contributes |
| --- | --- | --- |
| **Live page evidence** | **cheerio** HTML crawl, **Puppeteer** screenshot, **Google PageSpeed Insights** or **`fallbackLighthouse`** | Facts about *this* site — not a generic template |
| **Our own rules engine** | Heuristic CRO analyzer (`apps/api/src/lib/mock-ai.ts`) — no API key needed | Scores and issues from known conversion patterns (weak CTAs, form friction, missing proof, etc.) |
| **Spiralyze pattern library** | Curated A/B-test winners in `@cro/shared` (`win-patterns.ts`): uplift, win rate, sample size | Grounds recommended lifts and “With fixes” layouts in real experiments, not an AI guess |
| **Third-party AI (in use now)** | **Google Gemini** — `gemini-3.1-pro-preview` for the written audit, the section fill-in, and redesign callout boxes; `gemini-3-pro-image-preview` for the redesign image (`AI_PROVIDER=gemini`) | Richer written findings and the photorealistic “With fixes” concept |

**What we do *not* do:** collect customer pages into a training set, or fine-tune a Spiralyze-owned model. The AI is rented via API. Our proprietary knowledge is the **rules + the proven-pattern library**. The AI is instructed with the live page and those patterns; it does not “learn” from each audit.

**Right now (local `.env`):** `AI_PROVIDER=gemini`. The live models are **`gemini-3.1-pro-preview`** (audit, section critic, mockup region boxes) and **`gemini-3-pro-image-preview`** (mockup image). OpenAI and Anthropic are wired in the code but have no keys here, so if Gemini fails we fall back to **`mock-ai.ts`**, not GPT or Claude. If those keys were added, the API would try them before the rules engine.

Bot-blocked pages that we cannot screenshot skip Gemini on purpose and use the honest heuristic “blocked” report from **`mock-ai.ts`**.

---

## AI models we use

**In the local environment we are using Gemini only.**

| Job | Model or engine in use now |
| --- | --- |
| Written audit (score, issues, copy) | **Gemini `gemini-3.1-pro-preview`** (`AI_PROVIDER=gemini`, `GEMINI_MODEL`) |
| Fill in sections the first audit missed | **Same Gemini model** (`applySectionCritic`) |
| “With fixes” redesign image | **Gemini `gemini-3-pro-image-preview`** (`MOCKUP_MODEL`, `ENABLE_FIX_MOCKUP=true`) |
| Boxes on that redesign | **Gemini `gemini-3.1-pro-preview`**, or `MOCKUP_LOCATE_MODEL` if set |
| Boxes on the real screenshot | **Puppeteer landmark measurement** (`landmarks.ts`) — not a model |
| Layout choice and lift numbers | **Win-pattern library** (`win-patterns.ts`) |
| If Gemini fails | **`mock-ai.ts`** — not OpenAI or Anthropic (no keys configured) |
| Performance scores | **Google PageSpeed Insights** when the key works; otherwise **`fallbackLighthouse`** |

The stack can switch the written-audit provider. These are **available but not in use** unless a key is added and `AI_PROVIDER` is changed:

| Provider | Env | Model if enabled | Role |
| --- | --- | --- | --- |
| **OpenAI** | `OPENAI_API_KEY` / `OPENAI_MODEL` | `gpt-4o-mini` | Alternate vision audit |
| **Anthropic** | `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | `claude-3-5-sonnet-latest` | Alternate vision audit |
| **Heuristic engine** | `AI_PROVIDER=mock` | None | Rules-only mode (`mock-ai.ts`) |

`AI_PROVIDER` chooses who we try first: `mock` \| `gemini` \| `openai` \| `anthropic`. Mockup images stay **Gemini `gemini-3-pro-image-preview`** even if the written audit uses another provider. Can be turned off with `ENABLE_FIX_MOCKUP=false`.

### Other intelligence that is not a generative model

- **Google PageSpeed Insights API** — Lighthouse performance, accessibility, SEO, Core Web Vitals (`GOOGLE_PAGESPEED_API_KEY`). Missing key → **`fallbackLighthouse`**.
- **cheerio 1.0** — HTML structure. Not AI.
- **puppeteer-core 25.3** + Chromium — screenshot, consent dismissal, live-test detection, landmark boxes. Not AI.
- **Internet Archive CDX API** — archived snapshot when the live capture is unusable.
- **Google Sheet** (Apps Script webhook) — verified lead row and finding-feedback row. Not AI.

---

## Exact technology we use

Monorepo (`npm` workspaces): `apps/web` (UI), `apps/api` (analysis), `packages/shared` (`@cro/shared`). **Node.js 20+**.

### Application & language

| What | Exact thing |
| --- | --- |
| UI framework | **Next.js 14.2.35** (App Router) — `apps/web` |
| UI library | **React 18.3** + **react-dom 18.3** |
| API framework | **Hono 4.7** + **@hono/node-server 1.14** — `apps/api` |
| Language | **TypeScript 5.6** |
| Shared contracts | **`@cro/shared`** — **Zod 3.23** schemas and DTOs used by both apps |
| API runner | **tsx 4.19** |

### Hosting

| What | Exact thing |
| --- | --- |
| Website | **Vercel Hobby** (`apps/web`) |
| Analysis API | **GCP Cloud Run** (`apps/api` Docker image with system Chromium) |
| Share files and email codes | **Vercel Blob** (`@vercel/blob` 2.6) — share only when someone clicks Share; OTP hash whenever they request a code |
| Lead list | **Google Sheet** via Apps Script webhook (`GOOGLE_SHEET_WEBHOOK_URL`) — email, URL, score, geo, IP, user agent |
| On-screen report | Browser **`sessionStorage`**. Unlock token in **`localStorage`** for 7 days |
| Scheduled cleanup | **Vercel cron** deletes shared reports older than 30 days |
| Repeat-audit cache | Optional in-memory cache on the API (`ENABLE_RESULT_CACHE`, off by default). No database |

### Page capture & metrics

| What | Exact thing |
| --- | --- |
| HTML parse | **cheerio 1.0** |
| Screenshot | **puppeteer-core 25.3** driving Chrome/Chromium (`CHROME_EXECUTABLE_PATH` locally; system Chromium on Cloud Run) |
| Serverless Chromium fallback | **@sparticuz/chromium 149** |
| Archive fallback | **Internet Archive CDX API** (`lookupWayback`) |
| Performance | **Google PageSpeed Insights API**, or **`fallbackLighthouse`** when the key is missing or the call fails |

### Intelligence

| What | Exact thing |
| --- | --- |
| Written audit (**in use**) | **Gemini** `gemini-3.1-pro-preview` (`AI_PROVIDER=gemini`) |
| Section fill-in | **Same Gemini model** (`applySectionCritic`) |
| Written audit (not in use) | **OpenAI** `gpt-4o-mini` or **Anthropic** `claude-3-5-sonnet-latest` — code-ready, no keys set |
| Fallback audit | Our heuristic engine — `apps/api/src/lib/mock-ai.ts` |
| Redesign images | **Gemini** `gemini-3-pro-image-preview` (`MOCKUP_MODEL`) |
| Redesign callout boxes | **Gemini** `gemini-3.1-pro-preview` or `MOCKUP_LOCATE_MODEL` |
| Evidence for lifts / layouts | Spiralyze **win-pattern library** in `@cro/shared` |
| Output validation | **Zod 3.23** — malformed AI JSON is rejected and we fall back |

### UI, email, charts

| What | Exact thing |
| --- | --- |
| CSS | **Tailwind CSS 3.4** + **tailwindcss-animate 1.0** + **PostCSS 8.4** + **Autoprefixer 10.4** |
| Components | **shadcn/ui** on **Radix UI** (dialog, tabs, dropdown, popover, tooltip, progress, etc.) |
| Class helpers | **clsx 2.1**, **class-variance-authority 0.7**, **tailwind-merge 2.6** |
| Motion | **Framer Motion 11.15** |
| Charts | **Recharts 2.15** |
| Icons | **lucide-react 0.468** |
| Theme | **next-themes 0.4** (light / dark) |
| Email | **nodemailer 6.9** (SMTP — OTP + report summary) |

### Quality, security, tooling

| What | Exact thing |
| --- | --- |
| Tests | **Vitest 2.1** across capture, live tests, landmarks, mockups, Wayback, quote gate, SSRF, and sanitizer — plus `e2e/smoke.spec.ts` |
| Lint / format | **ESLint 8.57** + **eslint-config-next 14.2.35** + **Prettier 3.3** |
| Local env | **dotenv-cli 11** + **concurrently 9.1** |
| URL safety | SSRF guard (`net-guard.ts`) — block private / metadata targets; re-check redirects |
| Abuse | In-memory per-IP rate limits on analyze, mockup, email-code, report email, and finding feedback |
| Browser CORS | `CORS_ORIGINS` on the API |
| Prompt safety | Scraped page text sanitized (`sanitize.ts`) before it is put in an AI prompt |
| Chromium cap | `MAX_CONCURRENT_BROWSERS` so Cloud Run does not run out of memory |

See [`TECH_STACK.md`](TECH_STACK.md) for “why this stack” and [`DEPLOYMENT.md`](DEPLOYMENT.md) for how we ship it.

---

## What this is *not*

It is not a CMS, not a full A/B testing platform, and not a customer database of its own. It is a **self-serve diagnostic + sales teaser**: prove we understand their page, show a better version, and get them on a call. Verified emails are copied to a Google Sheet for marketing; that sheet is the lead list.

We also do not train a custom model on visitor sites. Quality comes from **live evidence + Spiralyze’s tested patterns + Gemini** (with the rules engine when the model is unavailable).
