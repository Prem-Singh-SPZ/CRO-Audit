# Tech Stack — What we use & why

A quick, plain-English guide to every major technology in **CRO Audit AI** and the reason it's there. Use it to explain the project to anyone.

## The one-paragraph pitch

CRO Audit AI is a **split frontend/backend** app: a **Next.js** UI on Vercel Hobby, and a **Hono** API on GCP Cloud Run that takes a website URL, looks at that page the way a conversion expert would (its HTML, a real screenshot, and Google's performance data), and returns an interactive **Conversion Rate Optimization** report — a score, prioritized issues, fixes, and an AI "after" redesign of the hero. It runs **without a database or background workers**. It works with **zero API keys** (a built-in heuristic engine) and gets smarter when you add a vision-LLM key.

---

## Core framework

| Tech | What it is | Why we use it |
| --- | --- | --- |
| **Next.js 14 (App Router)** | React UI framework (`apps/web`) | Landing page + interactive report. Deploys to **Vercel Hobby** with no long-running functions. |
| **Hono** | Lightweight Node HTTP framework (`apps/api`) | Hosts `/api/analyze` and `/api/mockup` on **GCP Cloud Run** with long timeouts and Chromium — no Vercel Pro needed. |
| **React 18** | UI library | Component model for the landing page and the rich, interactive report. |
| **TypeScript** | Typed JavaScript | Catches bugs at build time; shared contracts live in `@cro/shared`. |
| **`@cro/shared`** | Shared Zod schemas + DTOs | One source of truth for request/response types used by both UI and API. |

## Styling & UI

| Tech | What it is | Why we use it |
| --- | --- | --- |
| **Tailwind CSS** | Utility-first CSS | Build a consistent, responsive design fast without writing custom CSS files. |
| **shadcn/ui + Radix UI** | Accessible component primitives | Production-quality, accessible building blocks we own and can style. |
| **Framer Motion** | Animation library | Smooth transitions; respects "reduced motion". |
| **Recharts** | Charting library | Score gauge and category breakdown charts. |
| **lucide-react** | Icon set | Clean, consistent icons. |
| **next-themes** | Theme switching | Light/dark mode support. |

## Data collection (how we "see" the page)

| Tech | What it is | Why we use it |
| --- | --- | --- |
| **cheerio** | Server-side HTML parser | Extracts CRO signals — headline, CTAs, forms, nav, trust badges — cheaply and fast. |
| **Puppeteer + Chromium** | Headless Chrome in the API container | Captures a real full-page screenshot. Cloud Run Docker uses system Chromium; local dev uses `CHROME_EXECUTABLE_PATH`. `@sparticuz/chromium` remains available as a serverless fallback. |
| **Google PageSpeed Insights API** | Lighthouse-as-a-service | Objective performance / a11y / SEO scores and Core Web Vitals. |

## Intelligence (how we generate the audit)

| Tech | What it is | Why we use it |
| --- | --- | --- |
| **Heuristic engine** (`mock-ai.ts`) | Rules-based CRO analyzer | Default. Needs **no API key**; still page-specific. |
| **Vision LLMs — OpenAI / Anthropic / Gemini** | Models that read text **and** images | Richer findings when a key is present; fallback chain keeps scans working. |
| **Gemini image model** | Image generation | AI "after" hero concept via `/api/mockup`. |
| **Zod** | Schema validation | Every LLM response is validated; malformed payloads fall back. |

## Reliability & security

| Concern | How we handle it | Why it matters |
| --- | --- | --- |
| **SSRF protection** | Block private/metadata targets; re-check redirects | Users submit arbitrary URLs. |
| **Rate limiting** | Per-IP windows on analyze/mockup | Audits are expensive (browser + AI). |
| **CORS** | `CORS_ORIGINS` on the API | Only the Vercel UI (and local) can call the API from a browser. |
| **Prompt-injection hardening** | Sanitized untrusted blocks | Scraped content is data, not instructions. |
| **Concurrency cap** | Limit simultaneous Chromium instances | Prevents OOM on Cloud Run. |
| **Security headers** | Next.js `next.config.mjs` | Standard UI hardening. |

## Data flow (persistence)

**Stateless**: the report returns in the API response and lives in the browser's **`sessionStorage`** for `/report`. No database. Opt-in in-memory cache on the API can short-circuit repeats.

## Tooling & deploy

| Tech | Why |
| --- | --- |
| **npm workspaces** | Monorepo: `apps/web`, `apps/api`, `packages/shared`. |
| **Vitest** | Unit tests for SSRF + sanitizer helpers. |
| **Docker** (`apps/api/Dockerfile`) | Cloud Run image with system Chromium. |
| **Vercel Hobby + Cloud Run free tier** | UI on Vercel; long audits + Chromium on GCP. |

See [`DEPLOYMENT.md`](DEPLOYMENT.md) for deploy steps.
