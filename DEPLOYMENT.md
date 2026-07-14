# Deployment Guide

CRO Audit AI is a stateless Next.js app with no database, browser, or background
worker. It deploys cleanly to **Vercel** (or any Next.js host).

## Deploy to Vercel

1. Push this repo to GitHub/GitLab/Bitbucket.
2. In Vercel: **Add New Project → Import** the repo.
3. Set **Root Directory** to `apps/web` (this is a monorepo; the app lives there).
   Vercel auto-detects Next.js; the build command is `next build` (see
   [`apps/web/vercel.json`](apps/web/vercel.json)).
4. Add environment variables (Project → Settings → Environment Variables):

   | Key | Value |
   | --- | --- |
   | `NEXT_PUBLIC_APP_URL` | your Vercel URL (e.g. `https://your-app.vercel.app`) |
   | `GOOGLE_PAGESPEED_API_KEY` | free key from Google Cloud (see below) |
   | `MICROLINK_API_KEY` | optional — screenshots work keyless; set for higher limits |
   | `AI_PROVIDER` | `mock` (or `openai` / `anthropic`) |
   | `OPENAI_API_KEY` / `OPENAI_MODEL` | required if `AI_PROVIDER=openai` |
   | `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | required if `AI_PROVIDER=anthropic` |
   | `NEXT_PUBLIC_BRAND_NAME` | your brand name |
   | `NEXT_PUBLIC_COMPANY` | your company name |
   | `NEXT_PUBLIC_LOGO_TEXT` | logo text |
   | `NEXT_PUBLIC_SITE_TITLE` | metadata title |
   | `NEXT_PUBLIC_HERO_BADGE` | hero badge copy |
   | `NEXT_PUBLIC_FOOTER_DESCRIPTION` | footer blurb |
   | `NEXT_PUBLIC_BOOK_CALL_URL` | booking link |
   | `NEXT_PUBLIC_CONTACT_URL` | `mailto:` link |
   | `NEXT_PUBLIC_CONTACT_EMAIL` | contact email |
   | `NEXT_PUBLIC_PHONE` | phone number |
   | `NEXT_PUBLIC_ADDRESS_LINE1` / `NEXT_PUBLIC_ADDRESS_CITY` | address |

5. Deploy. After the first deploy, set `NEXT_PUBLIC_APP_URL` to the assigned
   domain and **redeploy** (the `NEXT_PUBLIC_*` values are inlined at build time).

## Google PageSpeed Insights API key

The report uses the PageSpeed Insights API for Lighthouse scores + Core Web Vitals.

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials).
2. Enable the **PageSpeed Insights API** and create an **API key**.
3. Set it as `GOOGLE_PAGESPEED_API_KEY` in Vercel.

Free tier: **25,000 requests/day**. Without a key the API is heavily
rate-limited (HTTP 429), and the app falls back to a heuristic performance
estimate.

## Screenshots (Microlink)

Screenshots are captured via the [Microlink API](https://microlink.io/) and
returned as hosted image URLs. It works **keyless** on the free tier (IP
rate-limited). For production reliability and higher limits, create a key and
set `MICROLINK_API_KEY`.

## Report intelligence (hybrid)

- `AI_PROVIDER=mock` (default): a page-specific heuristic engine, no keys needed.
- `AI_PROVIDER=openai` / `anthropic`: a real vision LLM reads the page +
  screenshots for exclusive findings, and auto-falls back to the heuristic
  engine if the call fails or is misconfigured.

## Function timeout

Analysis runs the crawl, PageSpeed (mobile + desktop), and screenshots in
parallel, then optionally an LLM call — it can take ~15-45 seconds. The
`POST /api/analyze` route declares `maxDuration = 60`.

- **Vercel Pro/Enterprise:** 60s limit — recommended.
- **Vercel Hobby:** 10s limit — will time out on real sites. Upgrade, or reduce
  the PageSpeed timeout / run a single strategy in
  `apps/web/src/lib/pagespeed.ts`.

## Local production build

```bash
npm run build
npm run start   # http://localhost:3000
```
