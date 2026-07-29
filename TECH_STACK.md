# Tech Stack — What we use & why

A quick, plain-English guide to every major technology in **CRO Audit AI** and the reason it's there. Use it to explain the project to anyone.

## The one-paragraph pitch

CRO Audit AI is a single **Next.js** app that takes a website URL, looks at that page the way a conversion expert would (its HTML, a real screenshot, and Google's performance data), and returns an interactive **Conversion Rate Optimization** report — a score, prioritized issues, fixes, and an AI "after" redesign of the hero. It runs **without a database or background workers**: one API request does the whole audit and streams back the result. It works with **zero API keys** (a built-in heuristic engine) and gets smarter when you add a vision-LLM key.

---

## Core framework

| Tech | What it is | Why we use it |
| --- | --- | --- |
| **Next.js 14 (App Router)** | Full-stack React framework | One codebase for both the UI and the backend API routes (`/api/analyze`, `/api/mockup`). Server-side rendering for a fast, SEO-friendly landing page; serverless functions for the audit. Deploys to Vercel with no infra to manage. |
| **React 18** | UI library | Component model for the landing page and the rich, interactive report. |
| **TypeScript** | Typed JavaScript | Catches bugs at build time and makes the data flowing between crawler → AI → UI safe and self-documenting. |

## Styling & UI

| Tech | What it is | Why we use it |
| --- | --- | --- |
| **Tailwind CSS** | Utility-first CSS | Build a consistent, responsive design fast without writing custom CSS files. |
| **shadcn/ui + Radix UI** | Accessible component primitives (dialogs, tabs, tooltips, progress, etc.) | Production-quality, accessible building blocks we own and can style — no heavy component library lock-in. |
| **Framer Motion** | Animation library | Smooth, polished transitions; respects users' "reduced motion" preference. |
| **Recharts** | Charting library | Renders the score gauge and category breakdown charts in the report. |
| **lucide-react** | Icon set | Clean, consistent icons throughout the UI. |
| **next-themes** | Theme switching | Light/dark mode support. |

## Data collection (how we "see" the page)

| Tech | What it is | Why we use it |
| --- | --- | --- |
| **cheerio** | Server-side HTML parser (like jQuery for the backend) | Fetches the target page's HTML and extracts CRO signals — headline, CTAs, form fields, nav, trust badges, meta tags — cheaply and fast. |
| **Puppeteer + `@sparticuz/chromium`** | Headless Chrome that runs *inside* our serverless function | Captures a real full-page screenshot so the AI can judge the actual visual design (not just the code). `@sparticuz/chromium` is a slimmed Chromium that fits Vercel's size limits; no external screenshot service needed. |
| **Google PageSpeed Insights API** | Google's Lighthouse-as-a-service | Gives objective performance, accessibility, best-practices, SEO scores and Core Web Vitals — credible, third-party numbers we don't have to compute ourselves. |

## Intelligence (how we generate the audit)

| Tech | What it is | Why we use it |
| --- | --- | --- |
| **Heuristic engine** (`mock-ai.ts`) | Our own rules-based CRO analyzer | The default. Needs **no API key** and still produces page-specific reports by quoting the site's real headline, CTAs, and metrics. Guarantees the product always works. |
| **Vision LLMs — OpenAI / Anthropic / Gemini** (optional) | Large language models that read text **and** images | When a key is present, the model reads the page signals + screenshot and returns richer, page-specific findings. We try the configured provider first, then fall back through the others, then the heuristic engine — so a single outage never breaks a scan. |
| **Gemini image model** (optional) | Image-generation model | Produces the AI "after" concept — a redesigned version of the page's hero section showing the fixes visually. |
| **Zod** | Schema validation | Every LLM response is validated against a strict schema. If the model returns malformed or incomplete JSON, we reject it and fall back — the UI never receives garbage. |

## Reliability & security (the invisible but important parts)

| Concern | How we handle it | Why it matters |
| --- | --- | --- |
| **SSRF protection** (`net-guard.ts`) | Block requests to internal/private/cloud-metadata addresses; re-check after redirects | Users submit arbitrary URLs — we must never let the server be tricked into hitting internal systems. |
| **Rate limiting** (`rate-limit.ts`) | Per-IP token bucket on both API routes | Audits are expensive (browser + AI); this stops abuse and runaway costs. |
| **Prompt-injection hardening** (`sanitize.ts`) | Wrap scraped/user text in labelled "untrusted" blocks, strip control chars | Scraped page content could contain "ignore your instructions" text — we make sure the model treats it as *data to audit*, not commands. |
| **Concurrency cap** | Semaphore limiting simultaneous Chromium instances | Chromium is memory-hungry; a burst of scans could crash the function otherwise. |
| **Structured logging** (`logger.ts`) | Single-line JSON logs with scan id, host, provider, duration | Makes production issues debuggable; a clean hook point for an error tracker (e.g. Sentry). |
| **Security headers** | Set in `next.config.mjs` | Standard hardening (clickjacking, MIME sniffing, referrer policy, HSTS). |

## Data flow (persistence)

We keep it **stateless**: the finished report is returned in the API response and held in the browser's **`sessionStorage`** to render `/report`. There's no database. An **opt-in in-memory cache** can short-circuit repeat scans of the same URL to save cost/latency. (Durable, shareable report links would require adding a datastore — intentionally deferred.)

## Tooling & ops

| Tech | What it is | Why we use it |
| --- | --- | --- |
| **npm workspaces (monorepo)** | Multi-package repo layout | Room to grow (the app lives in `apps/web`) while keeping one install/lockfile. |
| **Vitest** | Unit test runner | Fast tests for the critical security helpers (SSRF guard, input sanitizer). |
| **ESLint + `tsc --noEmit`** | Linting & type-checking | Enforced in CI so broken or unsafe code can't merge. |
| **GitHub Actions** | CI pipeline | Runs lint → type-check → tests → build → `npm audit` on every push/PR. |
| **Docker** | Containerization | An alternative to Vercel: builds the Next.js standalone output with a system Chromium, runs as a non-root user. |

---

## Why this architecture (the 30-second version)

- **Stateless & serverless** → cheap, simple to deploy, scales automatically, nothing to babysit.
- **Hybrid AI** → works with zero keys, upgrades gracefully with keys, and never hard-fails thanks to the fallback chain.
- **Real screenshot + real Lighthouse data** → the audit is grounded in what the page *actually* looks like and how it *actually* performs, not guesswork.
- **Security-first** → because we accept arbitrary URLs and feed page content to an AI, SSRF and prompt-injection defenses are built in, not bolted on.
