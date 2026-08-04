# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# CRO Audit API — GCP Cloud Run.
#
# Uses @sparticuz/chromium (bundled serverless binary) for screenshots —
# Debian system Chromium crashes on Cloud Run (SIGTRAP / crashpad).
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
# Do NOT set CHROME_EXECUTABLE_PATH here — that forces broken system Chromium.
# Screenshots use @sparticuz/chromium from node_modules instead.
ENV HOME=/tmp
ENV XDG_CONFIG_HOME=/tmp/.chromium
ENV XDG_CACHE_HOME=/tmp/.chromium

# Fonts only (needed for readable screenshots). No apt chromium package.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    fonts-noto-color-emoji \
    fonts-noto-cjk \
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
