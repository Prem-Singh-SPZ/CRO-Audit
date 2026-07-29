# CRO Audit AI

An AI-powered **Conversion Rate Optimization (CRO) website analyzer** and lead-generation tool. Users enter a URL; the app crawls the page, captures a full-page screenshot, pulls Lighthouse metrics, and produces an interactive CRO report with an overall score, category breakdowns, annotated screenshots, an AI "after" redesign concept, a priority matrix, and prioritized recommendations.

> **Hybrid intelligence:** with no API keys the app uses a **page-specific heuristic engine** (it quotes the real headline, CTA labels, form fields, nav, and metrics — reports genuinely differ per site). Add an OpenAI, Anthropic, or Gemini key and it upgrades to a **real vision LLM** that reads the page + screenshot and returns exclusive findings, falling back to the heuristic engine on any error.

## Architecture

A single **Next.js (App Router)** app — **stateless** (no database, queue, or worker) and Vercel-friendly:

- **cheerio** fetches the target page's HTML server-side and extracts CRO signals (headings, CTAs, forms, images, meta, trust signals).
- **Puppeteer + `@sparticuz/chromium`** captures an in-process full-page desktop screenshot (base64 / data URI — no external screenshot service). Locally, point `CHROME_EXECUTABLE_PATH` at an installed Chrome/Edge.
- **Google PageSpeed Insights API** provides Lighthouse scores (performance, accessibility, best-practices, SEO) and Core Web Vitals metrics.
- The **report generator** (`lib/ai.ts`) turns those signals + the screenshot into a structured, Zod-validated report via a real vision LLM or the heuristic engine.
- The audit runs **synchronously in one API request** (`POST /api/analyze`). The **"after" redesign concept** is generated separately by `POST /api/mockup` (Gemini image model) so the slow image render never blocks the audit.

```
cro-audit-ai/
└── apps/
    └── web/                       # Next.js app
        └── src/
            ├── app/
            │   ├── api/analyze/   # main analysis endpoint
            │   ├── api/mockup/    # deferred "after" concept image
            │   ├── report/        # client-state report page
            │   └── page.tsx       # landing page
            ├── components/        # landing + report UI
            └── lib/
                ├── analyzer.ts    # cheerio HTML extraction
                ├── pagespeed.ts   # PageSpeed Insights (Lighthouse)
                ├── screenshot.ts  # Puppeteer/Chromium capture + concurrency cap
                ├── ai.ts          # hybrid generator (LLM + heuristic fallback)
                ├── mock-ai.ts     # page-specific heuristic CRO engine
                ├── mockup.ts      # Gemini "after" concept image
                ├── net-guard.ts   # SSRF protection for user URLs
                ├── rate-limit.ts  # per-IP rate limiting
                ├── sanitize.ts    # prompt-injection input hardening
                └── cro/           # shared constants, zod schema, types
```

### Data flow

1. User submits a URL on the landing page.
2. `POST /api/analyze` **rate-limits** the caller, validates the URL, and runs an **SSRF check** (blocks internal/private/reserved targets and DNS-rebinding).
3. In parallel: parses the HTML (cheerio), pulls PageSpeed metrics, and captures the screenshot (Puppeteer). Blocked/bot-walled pages are detected and get an honest "limited analysis" report instead of a fabricated one.
4. The report generator produces scores, issues, and recommendations — via a vision LLM if a key is set, otherwise the heuristic engine. Per-issue lift estimates are grounded in a proven A/B-test pattern library where a comparable pattern exists.
5. The full report JSON is returned; the client stores it in `sessionStorage` and renders the interactive report at `/report`, then requests the "after" concept in the background.

## Tech stack

Next.js (App Router) · TypeScript · TailwindCSS · shadcn/ui · Framer Motion · Recharts · cheerio · Puppeteer + `@sparticuz/chromium` · Google PageSpeed Insights · OpenAI / Anthropic / Gemini (optional) · Zod · Vitest.

## Quick start

Requires **Node 20+**.

```bash
npm install
cp .env.example .env        # defaults work out of the box (mock AI)
# For local screenshots, set CHROME_EXECUTABLE_PATH in .env to an installed browser:
#   Windows: C:\Program Files\Google\Chrome\Application\chrome.exe
#   macOS:   /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
#   Linux:   /usr/bin/google-chrome
npm run dev                 # http://localhost:3000
```

Submit a URL and the report is generated on the fly.

> Set `GOOGLE_PAGESPEED_API_KEY` (free) for real Lighthouse scores; without it PageSpeed is rate-limited and the app falls back to a heuristic performance estimate. Without `CHROME_EXECUTABLE_PATH` locally, the screenshot is skipped (the rest of the audit still works).

## Switching the AI provider

The report generator (`apps/web/src/lib/ai.ts`) defaults to the built-in **page-specific heuristic engine** (`AI_PROVIDER=mock`). To use a real vision LLM, set `AI_PROVIDER` to `openai`, `anthropic`, or `gemini` and provide the matching API key; optionally override the model with `*_MODEL`. The LLM receives the crawled signals **and** the screenshot, and its output is schema-validated — any failure automatically falls back to the heuristic engine, so the app never breaks.

## Feature flags & tuning

| Env | Purpose |
| --- | --- |
| `AI_PROVIDER` | `mock` \| `openai` \| `anthropic` \| `gemini` |
| `ENABLE_FIX_MOCKUP` | `false` disables the "With fixes" AI concept image |
| `MOCKUP_MODEL` / `MOCKUP_IMAGE_SIZE` / `MOCKUP_ASPECT_RATIO` | Gemini image model tuning |
| `RATE_LIMIT_ANALYZE_MAX` / `RATE_LIMIT_ANALYZE_WINDOW_MS` | per-IP limit for `/api/analyze` (default 10/min) |
| `RATE_LIMIT_MOCKUP_MAX` / `RATE_LIMIT_MOCKUP_WINDOW_MS` | per-IP limit for `/api/mockup` (default 15/min) |
| `MAX_CONCURRENT_BROWSERS` | cap on simultaneous Chromium instances (default 2) |
| `ENABLE_RESULT_CACHE` | `true` caches full audits per `{url, provider, context}` (opt-in) |
| `RESULT_CACHE_TTL_MS` / `RESULT_CACHE_MAX_ENTRIES` | cache TTL and size cap |
| `CHROME_EXECUTABLE_PATH` | local Chrome/Edge path for screenshots |

> **Provider fallback:** the report generator tries the configured `AI_PROVIDER`
> first, then any other providers with keys present (`gemini → openai →
> anthropic`), then the heuristic engine — the actual producer is returned as
> `aiProvider` and any fallback reason is logged.

> The in-memory rate limiter protects a single instance. For a multi-instance fleet, back it with a shared store (Upstash Redis / Vercel KV) using the same interface in `lib/rate-limit.ts`.

## Scripts

| Command | Description |
| ------- | ----------- |
| `npm run dev` | Start the app locally |
| `npm run build` | Production build |
| `npm run start` | Start the production server |
| `npm run lint` | Lint |
| `npm run typecheck` | Type-check (`tsc --noEmit`) |
| `npm test` | Run the Vitest unit tests (SSRF/URL + sanitizer helpers) |

## Security

- **SSRF protection** (`lib/net-guard.ts`): blocks non-http(s) schemes, private/reserved IPs, cloud metadata, and internal hostnames; re-validates after redirects and filters Puppeteer subrequests.
- **Rate limiting** (`lib/rate-limit.ts`) on both API routes.
- **Prompt-injection hardening** (`lib/sanitize.ts`): scraped copy and user context are wrapped in labelled untrusted blocks and stripped of control/zero-width chars.
- **Security headers** are set in `next.config.mjs`.

## Environment variables

See [`.env.example`](.env.example). Key ones: `NEXT_PUBLIC_APP_URL`, `GOOGLE_PAGESPEED_API_KEY` (optional), `CHROME_EXECUTABLE_PATH` (local), `AI_PROVIDER` (+ the matching `*_API_KEY`), the mockup/rate-limit tuning above, and the `NEXT_PUBLIC_*` branding/contact values.

## Roadmap (deferred — need an infra/product decision)

- **Shareable / permanent report links + history.** The schema already stubs
  `shareId` / `readOnly`, but persisting reports beyond the current browser needs
  a durable store (Postgres / Vercel KV / S3 for images). Left out so the store
  choice stays a deliberate decision rather than a default.
- **Per-device / multi-section mockups.** The "after" concept currently re-imagines
  the desktop hero only. Mobile/tablet or full-page variants require capturing
  extra viewports and additional image-model calls (more cost + latency).

The **provider fallback chain** and **opt-in result caching** ideas from the plan
are implemented (see above).

## Deployment

See [`DEPLOYMENT.md`](DEPLOYMENT.md). Deploys to Vercel (**Pro tier or higher required** — the audit function needs up to 120s), or run the included [`apps/web/Dockerfile`](apps/web/Dockerfile) anywhere.

## License

Proprietary - built for commercial use by a CRO agency.
