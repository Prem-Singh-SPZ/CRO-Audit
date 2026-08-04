# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# CRO Audit API — GCP Cloud Run.
#
# Screenshots use @sparticuz/chromium (bundled serverless binary). That binary
# still needs a few OS shared libraries (e.g. libnspr4.so / libnss3).
#
# Build from the MONOREPO ROOT:
#   docker build -t cro-audit-api .
#
# Cloud Run suggested settings:
#   --memory 2Gi --cpu 1 --timeout 300 --concurrency 1 --min-instances 0
# ---------------------------------------------------------------------------

FROM node:20-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV PUPPETEER_SKIP_DOWNLOAD=1
ENV NEXT_TELEMETRY_DISABLED=1
# Do NOT set CHROME_EXECUTABLE_PATH — screenshots use @sparticuz/chromium.
ENV HOME=/tmp
ENV XDG_CONFIG_HOME=/tmp/.chromium
ENV XDG_CACHE_HOME=/tmp/.chromium

# Shared libs required by @sparticuz/chromium + fonts for readable screenshots.
# (Do not install the apt `chromium` package — it SIGTRAPs on Cloud Run.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    fonts-noto-color-emoji \
    fonts-noto-cjk \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libatspi2.0-0 \
    libxshmfence1 \
    libpango-1.0-0 \
    libcairo2 \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /tmp/.chromium \
  && chmod 777 /tmp/.chromium

COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci --omit=dev --workspace @cro/api --workspace @cro/shared --include-workspace-root

COPY apps/api ./apps/api
COPY packages/shared ./packages/shared

EXPOSE 8080

WORKDIR /app/apps/api
CMD ["npx", "tsx", "src/index.ts"]
