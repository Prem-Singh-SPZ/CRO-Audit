# CRO Audit AI

An AI-powered **Conversion Rate Optimization (CRO) website analyzer** and lead-generation tool. Users enter a URL; the app crawls the page, captures a full-page screenshot, pulls Lighthouse metrics, and produces an interactive CRO report with an overall score, category breakdowns, annotated screenshots, an AI "after" redesign concept, a priority matrix, and prioritized recommendations.

> **Hybrid intelligence:** with no API keys the app uses a **page-specific heuristic engine** (it quotes the real headline, CTA labels, form fields, nav, and metrics — reports genuinely differ per site). Add an OpenAI, Anthropic, or Gemini key and it upgrades to a **real vision LLM** that reads the page + screenshot and returns exclusive findings, falling back to the heuristic engine on any error.

## Architecture

Split for free-tier hosting:

| App | Role | Deploy |
| --- | --- | --- |
| `apps/web` | Next.js UI (landing + `/report`) | **Vercel Hobby** |
| `apps/api` | Hono API + Chromium + AI | **GCP Cloud Run** |
| `packages/shared` | Zod schemas + API DTOs (`@cro/shared`) | imported by both |

- **cheerio** (API) fetches HTML and extracts CRO signals.
- **Puppeteer + Chromium** (API) captures a full-page desktop screenshot. Locally set `CHROME_EXECUTABLE_PATH`; Cloud Run uses system Chromium in the Docker image.
- **Google PageSpeed Insights API** provides Lighthouse scores and Core Web Vitals.
- **Report generator** (`apps/api/src/lib/ai.ts`) produces a Zod-validated report via a vision LLM or the heuristic engine.
- `POST /api/analyze` runs the audit; `POST /api/mockup` generates the deferred "after" concept (Gemini image model).

```
cro-audit-ai/
├── apps/
│   ├── web/                 # Next.js UI → Vercel
│   └── api/                 # Hono API → Cloud Run
│       ├── Dockerfile
│       └── src/
│           ├── routes/      # analyze, mockup
│           └── lib/         # analyzer, screenshot, ai, …
└── packages/
    └── shared/              # @cro/shared contracts
```

### Data flow

1. User submits a URL on the Vercel-hosted landing page.
2. The browser calls `NEXT_PUBLIC_API_URL/api/analyze` (Cloud Run).
3. The API rate-limits, validates the URL (SSRF guard), then in parallel: cheerio crawl, PageSpeed, Puppeteer screenshot.
4. The report generator produces scores/issues; the client stores the JSON in `sessionStorage` and opens `/report`.
5. The report page requests `/api/mockup` in the background for the "With fixes" concept.

## Tech stack

Next.js (App Router) · Hono · TypeScript · TailwindCSS · shadcn/ui · Framer Motion · Recharts · cheerio · Puppeteer · Google PageSpeed Insights · OpenAI / Anthropic / Gemini (optional) · Zod · Vitest.

## Quick start

Requires **Node 20+**.

```bash
npm install
cp .env.example .env
# Set CHROME_EXECUTABLE_PATH to a local Chrome/Edge for screenshots
# Ensure NEXT_PUBLIC_API_URL=http://localhost:8080
npm run dev                 # web :3000 + api :8080
```

Or run separately: `npm run dev:web` / `npm run dev:api`.

> Set `GOOGLE_PAGESPEED_API_KEY` (free) on the API for real Lighthouse scores. Without `CHROME_EXECUTABLE_PATH` locally, screenshots are skipped (the rest of the audit still works).

## Switching the AI provider

Configured on the **API** (`AI_PROVIDER`). Defaults to the heuristic engine (`mock`). Set `openai` / `anthropic` / `gemini` plus the matching key. Failures fall back through other keyed providers, then the heuristic engine.

## Feature flags & tuning

| Env | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Backend base URL (required in production) |
| `CORS_ORIGINS` | Allowed browser origins for the API |
| `AI_PROVIDER` | `mock` \| `openai` \| `anthropic` \| `gemini` |
| `ENABLE_FIX_MOCKUP` | `false` disables the "With fixes" concept |
| `RATE_LIMIT_*` / `MAX_CONCURRENT_BROWSERS` | abuse / Chromium caps |
| `ENABLE_RESULT_CACHE` | opt-in in-memory audit cache |
| `CHROME_EXECUTABLE_PATH` | local Chrome/Edge path |

## Scripts

| Command | Description |
| ------- | ----------- |
| `npm run dev` | Start web + API together |
| `npm run dev:web` / `dev:api` | Start one app |
| `npm run build` | Typecheck API + build web |
| `npm run start` | Start Next.js production server |
| `npm run start:api` | Start API |
| `npm run lint` / `typecheck` / `test` | Quality gates |

## Security

- **SSRF protection** (`apps/api/src/lib/net-guard.ts`)
- **Rate limiting** on analyze/mockup
- **Prompt-injection hardening** (`sanitize.ts`)
- **CORS** locked to `CORS_ORIGINS`
- **Security headers** on the Next.js UI

## Environment variables

See [`.env.example`](.env.example). Put **only** `NEXT_PUBLIC_*` (including `NEXT_PUBLIC_API_URL`) on Vercel; keep all AI / PageSpeed / rate-limit secrets on Cloud Run.

## Deployment

See [`DEPLOYMENT.md`](DEPLOYMENT.md): **Vercel Hobby** for the UI + **GCP Cloud Run** for the API (Docker + Chromium). No Vercel Pro plan required.

## Roadmap (deferred)

- Shareable / permanent report links (needs a durable store).
- Per-device / multi-section mockups.

## License

Proprietary - built for commercial use by a CRO agency.
