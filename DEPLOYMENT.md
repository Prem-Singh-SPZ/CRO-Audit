# Deployment Guide

CRO Audit AI is split for free-tier hosting:

| Piece | App | Host |
| --- | --- | --- |
| UI (landing + report) | `apps/web` | **Vercel Hobby** |
| API (analyze + mockup + Chromium) | `apps/api` | **GCP Cloud Run** |

Shared Zod schemas / DTOs live in `packages/shared` (`@cro/shared`).

## 1. Deploy the API to GCP Cloud Run

Requires a GCP project with Cloud Run + Artifact Registry (or Cloud Build) enabled.
The always-free Cloud Run allowance is enough for light personal/demo traffic.

### Build & deploy

From the **monorepo root**:

```bash
# Build the image (includes system Chromium)
docker build -f apps/api/Dockerfile -t cro-audit-api .

# Tag + push to Artifact Registry (example)
# gcloud auth configure-docker REGION-docker.pkg.dev
# docker tag cro-audit-api REGION-docker.pkg.dev/PROJECT/REPO/cro-audit-api:latest
# docker push REGION-docker.pkg.dev/PROJECT/REPO/cro-audit-api:latest

gcloud run deploy cro-audit-api \
  --image REGION-docker.pkg.dev/PROJECT/REPO/cro-audit-api:latest \
  --region REGION \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 1 \
  --timeout 300 \
  --concurrency 1 \
  --min-instances 0 \
  --max-instances 3 \
  --set-env-vars "AI_PROVIDER=mock,CORS_ORIGINS=https://YOUR_VERCEL_APP.vercel.app,ENABLE_FIX_MOCKUP=true"
```

Then set secrets (Cloud Run → Edit & deploy new revision → Variables & secrets),
or via `--set-env-vars` / Secret Manager:

| Key | Notes |
| --- | --- |
| `CORS_ORIGINS` | Your Vercel URL(s), comma-separated |
| `GOOGLE_PAGESPEED_API_KEY` | optional but recommended |
| `AI_PROVIDER` | `mock` / `openai` / `anthropic` / `gemini` |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` | as needed |
| `GEMINI_*` / `MOCKUP_*` / `RATE_LIMIT_*` / `MAX_CONCURRENT_BROWSERS` | optional tuning |

> Do **not** set `CHROME_EXECUTABLE_PATH` on Cloud Run — the image already uses
> `/usr/bin/chromium`.

Copy the Cloud Run service URL (e.g. `https://cro-audit-api-xxxxx.run.app`).

### Health check

`GET /health` → `{ "ok": true, ... }`

## 2. Deploy the frontend to Vercel (Hobby)

1. Push the repo to GitHub/GitLab/Bitbucket.
2. In Vercel: **Add New Project → Import**.
3. Set **Root Directory** to `apps/web`.
   Install/build commands are already in [`apps/web/vercel.json`](apps/web/vercel.json)
   (they `cd` to the monorepo root so workspaces resolve).
4. Add **only** frontend env vars:

   | Key | Value |
   | --- | --- |
   | `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` |
   | `NEXT_PUBLIC_API_URL` | Cloud Run URL (no trailing slash) |
   | `NEXT_PUBLIC_BRAND_NAME` / `NEXT_PUBLIC_COMPANY` / … | branding |
   | `NEXT_PUBLIC_BOOK_CALL_URL` / contact fields | links |

   **Never** put AI keys, PageSpeed keys, or rate-limit secrets on Vercel.

5. Deploy. After the first deploy, confirm `NEXT_PUBLIC_*` values and redeploy
   if needed (`NEXT_PUBLIC_*` are inlined at build time).

6. Update Cloud Run `CORS_ORIGINS` to include the final Vercel domain, then
   redeploy the API revision.

## Local development

```bash
cp .env.example .env
# Set CHROME_EXECUTABLE_PATH to a local Chrome/Edge for screenshots
npm install
npm run dev
# web → http://localhost:3000
# api → http://localhost:8080
```

Or run separately: `npm run dev:web` / `npm run dev:api`.

## Free-tier notes

- **Vercel Hobby** is fine — the UI has no long-running serverless functions.
- **Cloud Run** scales to zero (`min-instances=0`). Expect a cold start (often
  10–30s) on the first audit after idle; Chromium is memory-heavy, so keep
  concurrency at 1–2 and memory at **2Gi**.
- **Gemini / OpenAI / Anthropic** billing is separate from GCP free tier.
- In-memory rate limits and result cache are **per instance** (acceptable for a
  single Cloud Run service).

## Google PageSpeed Insights API key

1. [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Enable **PageSpeed Insights API**, create an API key.
3. Set as `GOOGLE_PAGESPEED_API_KEY` on **Cloud Run** only.

Free tier: **25,000 requests/day**. Without a key the API is heavily
rate-limited and the app falls back to a heuristic performance estimate.

## Docker (API only)

```bash
docker build -f apps/api/Dockerfile -t cro-audit-api .
docker run -p 8080:8080 --env-file .env \
  -e CORS_ORIGINS=http://localhost:3000 \
  cro-audit-api
```
