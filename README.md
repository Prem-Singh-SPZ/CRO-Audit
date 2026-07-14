# CRO Audit AI

An AI-powered **Conversion Rate Optimization (CRO) website analyzer** and lead-generation tool. Users enter a URL; the app crawls the page, captures screenshots, pulls Lighthouse metrics, and produces an interactive CRO report with an overall score, category breakdowns, annotated screenshots, a priority matrix, and prioritized recommendations.

> **Hybrid intelligence:** with no API keys the app uses a **page-specific heuristic engine** (it quotes the real headline, CTA labels, form fields, nav, and metrics — reports genuinely differ per site). Add an OpenAI or Anthropic key and it upgrades to a **real vision LLM** that reads the page + screenshots and returns exclusive findings, falling back to the heuristic engine on any error.

## Architecture

A single **Next.js (App Router)** app — fully **stateless** and **Vercel-compatible**. There is no database, no queue, no background worker, and no browser to install:

- **cheerio** fetches the target page's HTML server-side and extracts CRO signals (headings, CTAs, forms, images, meta, trust signals).
- **Microlink API** captures hosted desktop + mobile screenshots (returns image URLs, not base64 — keeps the payload tiny). Keyless on the free tier.
- **Google PageSpeed Insights API** provides Lighthouse scores (performance, accessibility, best-practices, SEO) and Core Web Vitals metrics — no local Chromium required.
- The **report generator** (`lib/ai.ts`) turns those signals + screenshots into a structured, validated report via a real LLM or the heuristic engine.
- Everything runs **synchronously in one API request** (`POST /api/analyze`) and returns the full report; the client renders it immediately.

```
cro-audit-ai/
└── apps/
    └── web/                     # Next.js app (landing + report + /api/analyze)
        └── src/
            ├── app/
            │   ├── api/analyze/ # the single analysis endpoint
            │   ├── report/      # client-state report page
            │   └── page.tsx     # landing page
            ├── components/      # landing + report UI
            └── lib/
                ├── analyzer.ts   # cheerio HTML extraction
                ├── pagespeed.ts  # PageSpeed Insights (Lighthouse metrics)
                ├── screenshot.ts # Microlink screenshot capture
                ├── ai.ts         # hybrid generator (LLM + heuristic fallback)
                ├── mock-ai.ts    # page-specific heuristic CRO engine
                └── cro/          # shared constants, zod schema, types
```

### Data flow

1. User submits a URL on the landing page.
2. `POST /api/analyze` validates the URL, then in parallel: parses the HTML (cheerio), pulls PageSpeed metrics, and captures screenshots (Microlink).
3. The report generator produces scores, issues, and recommendations — via a vision LLM if a key is set, otherwise the heuristic engine.
4. The full report JSON is returned in the response.
5. The client stores it in `sessionStorage` and renders the interactive report at `/report`.

## Tech stack

Next.js (App Router) · TypeScript · TailwindCSS · shadcn/ui · Framer Motion · Recharts · cheerio · Microlink · Google PageSpeed Insights · OpenAI/Anthropic (optional) · Zod.

## Quick start

Requires only **Node 20+**. No database, Redis, Docker, or browser.

```bash
npm install
cp .env.example .env        # defaults work out of the box (mock AI)
npm run dev                 # http://localhost:3000
```

Submit a URL and the report is generated on the fly.

> Set `GOOGLE_PAGESPEED_API_KEY` (free) for real Lighthouse scores; without it PageSpeed is rate-limited and the app falls back to a heuristic performance estimate. Screenshots use Microlink and work keyless on the free tier — set `MICROLINK_API_KEY` for higher limits in production.

## Switching the AI provider

The report generator (`apps/web/src/lib/ai.ts`) defaults to the built-in **page-specific heuristic engine** (`AI_PROVIDER=mock`). To use a real vision LLM, set `AI_PROVIDER=openai` (or `anthropic`) and provide the matching API key (`OPENAI_API_KEY` / `ANTHROPIC_API_KEY`); optionally override the model with `OPENAI_MODEL` / `ANTHROPIC_MODEL`. The LLM receives the crawled signals **and** the screenshots, and its output is schema-validated — any failure automatically falls back to the heuristic engine, so the app never breaks.

## Scripts

| Command | Description |
| ------- | ----------- |
| `npm run dev` | Start the app locally |
| `npm run build` | Production build |
| `npm run start` | Start the production server |
| `npm run lint` | Lint |

## Environment variables

See [`.env.example`](.env.example). Key ones: `NEXT_PUBLIC_APP_URL`, `GOOGLE_PAGESPEED_API_KEY` (optional), `MICROLINK_API_KEY` (optional), `AI_PROVIDER` (+ `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`), and the `NEXT_PUBLIC_*` branding/contact values.

## Deployment

See [`DEPLOYMENT.md`](DEPLOYMENT.md) — deploys to Vercel in a few clicks.

## License

Proprietary - built for commercial use by a CRO agency.
