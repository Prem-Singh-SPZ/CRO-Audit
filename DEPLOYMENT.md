# Deployment Guide

CRO Audit AI is a stateless Next.js app (no database or background worker). It
captures screenshots **in-process** with headless Chromium, so it needs a host
that allows generous function memory/duration. It deploys to **Vercel (Pro tier
or higher)** or any container platform via the included Dockerfile.

## Deploy to Vercel

1. Push this repo to GitHub/GitLab/Bitbucket.
2. In Vercel: **Add New Project → Import** the repo.
3. Set **Root Directory** to `apps/web` (this is a monorepo; the app lives there).
   Vercel auto-detects Next.js; the build command is `next build` and the
   function limits are set in [`apps/web/vercel.json`](apps/web/vercel.json).
4. Add environment variables (Project → Settings → Environment Variables):

   | Key | Value |
   | --- | --- |
   | `NEXT_PUBLIC_APP_URL` | your Vercel URL (e.g. `https://your-app.vercel.app`) |
   | `GOOGLE_PAGESPEED_API_KEY` | free key from Google Cloud (see below) |
   | `AI_PROVIDER` | `mock`, `openai`, `anthropic`, or `gemini` |
   | `OPENAI_API_KEY` / `OPENAI_MODEL` | required if `AI_PROVIDER=openai` |
   | `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | required if `AI_PROVIDER=anthropic` |
   | `GEMINI_API_KEY` / `GEMINI_MODEL` | required if `AI_PROVIDER=gemini` |
   | `ENABLE_FIX_MOCKUP` | `true`/`false` — AI "after" concept (needs `GEMINI_API_KEY`) |
   | `RATE_LIMIT_*` / `MAX_CONCURRENT_BROWSERS` | optional tuning (see README) |
   | `NEXT_PUBLIC_BRAND_NAME` / `NEXT_PUBLIC_COMPANY` | branding |
   | `NEXT_PUBLIC_LOGO_TEXT` / `NEXT_PUBLIC_SITE_TITLE` | branding |
   | `NEXT_PUBLIC_HERO_BADGE` / `NEXT_PUBLIC_FOOTER_DESCRIPTION` | copy |
   | `NEXT_PUBLIC_BOOK_CALL_URL` / `NEXT_PUBLIC_CONTACT_URL` | links |
   | `NEXT_PUBLIC_CONTACT_EMAIL` / `NEXT_PUBLIC_PHONE` | contact |
   | `NEXT_PUBLIC_ADDRESS_LINE1` / `NEXT_PUBLIC_ADDRESS_CITY` | address |

   > Do **not** set `CHROME_EXECUTABLE_PATH` on Vercel — the bundled
   > `@sparticuz/chromium` binary is used automatically. Only set it for local dev.

5. Deploy. After the first deploy, set `NEXT_PUBLIC_APP_URL` to the assigned
   domain and **redeploy** (the `NEXT_PUBLIC_*` values are inlined at build time).

## Function limits (important)

The audit runs the crawl, PageSpeed, and a headless-Chromium screenshot in
parallel, then a vision-LLM call — so `POST /api/analyze` and `POST /api/mockup`
declare **`maxDuration = 120`** with elevated memory in
[`apps/web/vercel.json`](apps/web/vercel.json).

- **Vercel Pro / Enterprise:** required — supports the 120s limit and the memory
  headroom Chromium needs.
- **Vercel Hobby:** 10s function cap — the audit **will** time out. Upgrade to Pro.

## Google PageSpeed Insights API key

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials).
2. Enable the **PageSpeed Insights API** and create an **API key**.
3. Set it as `GOOGLE_PAGESPEED_API_KEY`.

Free tier: **25,000 requests/day**. Without a key the API is heavily
rate-limited (HTTP 429), and the app falls back to a heuristic performance
estimate. The app requests the **mobile** strategy and only falls back to desktop
if mobile fails (1 PSI call in the common case).

## Screenshots (in-process Chromium)

Screenshots are captured with `puppeteer-core` + `@sparticuz/chromium`, fully
in-process. Concurrency is capped by `MAX_CONCURRENT_BROWSERS` (default 2) so a
burst of audits can't exhaust function memory; over the cap, an audit degrades to
"no screenshot" rather than failing. If capture fails or the page is bot-walled,
the report is still produced from the crawl + PageSpeed + text.

## Report intelligence (hybrid)

- `AI_PROVIDER=mock` (default): a page-specific heuristic engine, no keys needed.
- `AI_PROVIDER=openai` / `anthropic` / `gemini`: a real vision LLM reads the page
  + screenshot for exclusive findings, and auto-falls back to the heuristic
  engine if the call fails or is misconfigured.

## Docker

A production [`apps/web/Dockerfile`](apps/web/Dockerfile) is included. It builds
the Next.js **standalone** output and ships a system Chromium for screenshots.
Build from the **monorepo root**:

```bash
docker build -f apps/web/Dockerfile -t cro-audit-web .
docker run -p 3000:3000 --env-file .env cro-audit-web
```

## Local production build

```bash
npm run build
npm run start   # http://localhost:3000
```
