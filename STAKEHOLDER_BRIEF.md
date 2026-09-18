# CRO Audit AI — Stakeholder brief

**CRO Audit AI** is a lead-generation tool for Spiralyze. Someone pastes a website URL and gets a conversion audit in a few minutes: a score, what’s hurting sign-ups or bookings, and a visual “after” of how the page could look. The goal is not just a report — it is to show the problem, then route them to **book a call**.

---

## What it does

1. Visitor lands on the site and enters their URL.
2. We look at the live page the way a CRO team would: the real HTML, a full-page screenshot, and Google performance data.
3. We return an interactive report: overall score, annotated issues on their screenshot, recommended experiments, and one or two AI redesign concepts.
4. Full detail is gated behind a short email code. They can email themselves a summary. Sales CTAs go to the Spiralyze demo / book-a-call link.

No login, no customer database. The report lives in their browser for that session.

---

## How it works

Think of it as **look at the page → diagnose → show the fix**.

- **Look:** A headless Chrome browser opens their site and takes a real screenshot. We also read the page’s structure (headline, forms, buttons) and pull Lighthouse scores from Google PageSpeed Insights.
- **Diagnose:** A vision AI model reads the screenshot plus the page text and writes the audit — *when an API key is configured*. If not, or if the AI fails, a built-in rules engine still produces a page-specific report.
- **Show the fix:** A second, slower step generates the “With fixes” mockup(s). Form-heavy pages get two proven layout patterns; marketing pages get a cleaner hero. Issues stay pinned on the real screenshot; each redesign gets its own callouts so boxes match that layout.

Email is a short HTML summary (score, bottleneck, top issues, book-a-call). Sharing a live report is optional and separate.

---

## Are we using our own learning, AI, or both?

**Both — and we do not train our own AI model.**

Results are a **hybrid** of four things:

| Source | What it is | What it contributes |
| --- | --- | --- |
| **Live page evidence** | HTML crawl, real screenshot, Google Lighthouse | Facts about *this* site — not a generic template |
| **Our own rules engine** | Heuristic CRO analyzer (`apps/api/src/lib/mock-ai.ts`) — no API key needed | Scores and issues from known conversion patterns (weak CTAs, form friction, missing proof, etc.) |
| **Spiralyze pattern library** | Curated A/B-test winners in `@cro/shared` (`win-patterns.ts`): uplift, win rate, sample size | Grounds recommended lifts and “With fixes” layouts in real experiments, not an AI guess |
| **Third-party AI (in use now)** | **Google Gemini** — `gemini-3.1-pro-preview` for the written audit, `gemini-3-pro-image-preview` for the redesign image (`AI_PROVIDER=gemini`) | Richer written findings and the photorealistic “With fixes” concept |

**What we do *not* do:** collect customer pages into a training set, or fine-tune a Spiralyze-owned model. The AI is rented via API. Our proprietary knowledge is the **rules + the proven-pattern library**. The AI is instructed with the live page and those patterns; it does not “learn” from each audit.

**Right now:** `AI_PROVIDER=gemini`. The live models are **`gemini-3.1-pro-preview`** (audit) and **`gemini-3-pro-image-preview`** (mockup). OpenAI and Anthropic are wired in the code but have no keys in this environment, so if Gemini fails we fall back to **our heuristic engine**, not GPT or Claude.

Bot-blocked / verification-wall pages skip the AI on purpose (the screenshot is not the real page) and use the honest heuristic “blocked” report.

---

## AI models we use

**In this environment we are using Gemini only.**

| Job | Model in use now |
| --- | --- |
| Written audit (score, issues, copy) | **`gemini-3.1-pro-preview`** (`AI_PROVIDER=gemini`, `GEMINI_MODEL`) |
| “With fixes” redesign image | **`gemini-3-pro-image-preview`** (`MOCKUP_MODEL`, `ENABLE_FIX_MOCKUP=true`) |
| If Gemini fails | Our heuristic engine — not OpenAI or Anthropic (no keys configured) |

The stack can switch providers. These are **available but not in use** unless a key is added and `AI_PROVIDER` is changed:

| Provider | Env | Model if enabled | Role |
| --- | --- | --- | --- |
| **OpenAI** | `OPENAI_API_KEY` / `OPENAI_MODEL` | `gpt-4o-mini` | Alternate vision audit |
| **Anthropic** | `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | `claude-3-5-sonnet-latest` | Alternate vision audit |
| **Heuristic engine** | `AI_PROVIDER=mock` | None | Rules-only mode |

`AI_PROVIDER` chooses who we try first: `mock` \| `gemini` \| `openai` \| `anthropic`. Mockups stay Gemini image even if the written audit uses another provider. Can be turned off with `ENABLE_FIX_MOCKUP=false`.

### Other intelligence that is not a generative model

- **Google PageSpeed Insights API** — Lighthouse performance, accessibility, SEO, Core Web Vitals (`GOOGLE_PAGESPEED_API_KEY`).
- **cheerio 1.0** + **puppeteer-core 25.3** + Chromium — structure and screenshot. Not AI; they are how we *see* the page.

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
| Optional share files | **Vercel Blob** (`@vercel/blob` 2.6) — only when someone clicks Share |
| Persistence | **None.** Report JSON in the browser `sessionStorage`. No database, no background workers. |

### Page capture & metrics

| What | Exact thing |
| --- | --- |
| HTML parse | **cheerio 1.0** |
| Screenshot | **puppeteer-core 25.3** driving Chrome/Chromium (`CHROME_EXECUTABLE_PATH` locally; system Chromium on Cloud Run) |
| Serverless Chromium fallback | **@sparticuz/chromium 149** |
| Performance | **Google PageSpeed Insights API** (Lighthouse scores + Core Web Vitals) |

### Intelligence

| What | Exact thing |
| --- | --- |
| Written audit (**in use**) | **Gemini** `gemini-3.1-pro-preview` (`AI_PROVIDER=gemini`) |
| Written audit (not in use) | **OpenAI** `gpt-4o-mini` or **Anthropic** `claude-3-5-sonnet-latest` — code-ready, no keys set |
| Fallback audit | Our heuristic engine — `apps/api/src/lib/mock-ai.ts` |
| Redesign images | **Gemini** `gemini-3-pro-image-preview` (`MOCKUP_MODEL`) |
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
| Tests | **Vitest 2.1** (SSRF + sanitizer helpers) |
| Lint / format | **ESLint 8.57** + **eslint-config-next 14.2.35** + **Prettier 3.3** |
| Local env | **dotenv-cli 11** + **concurrently 9.1** |
| URL safety | SSRF guard (block private / metadata targets; re-check redirects) |
| Abuse | Per-IP rate limits on analyze / mockup / email |
| Browser CORS | `CORS_ORIGINS` on the API |
| Prompt safety | Scraped page text sanitized before it is put in an AI prompt |
| Chromium cap | `MAX_CONCURRENT_BROWSERS` so Cloud Run does not run out of memory |

See [`TECH_STACK.md`](TECH_STACK.md) for “why this stack” and [`DEPLOYMENT.md`](DEPLOYMENT.md) for how we ship it.

---

## What this is *not*

It is not a CMS, not a full A/B testing platform, and not a stored customer-record system. It is a **self-serve diagnostic + sales teaser**: prove we understand their page, show a better version, and get them on a call.

We also do not train a custom model on visitor sites. Quality comes from **live evidence + Spiralyze’s tested patterns + (optional) frontier AI**.
