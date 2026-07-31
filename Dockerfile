# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# CRO Audit API — deploy to GCP Cloud Run (or any container host).
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
ENV CHROME_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_DOWNLOAD=1
ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    fonts-noto-color-emoji \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs apiuser

COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci --omit=dev --workspace @cro/api --workspace @cro/shared --include-workspace-root

COPY apps/api ./apps/api
COPY packages/shared ./packages/shared

USER apiuser
EXPOSE 8080

WORKDIR /app/apps/api
CMD ["npx", "tsx", "src/index.ts"]
