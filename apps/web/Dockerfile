# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# Container image for the CRO Audit web app (apps/web).
#
# Build from the MONOREPO ROOT so the npm workspace + lockfile resolve:
#   docker build -f apps/web/Dockerfile -t cro-audit-web .
#
# The image ships a system Chromium for Puppeteer (via CHROME_EXECUTABLE_PATH),
# so @sparticuz/chromium's serverless binary isn't needed here.
# ---------------------------------------------------------------------------

# ---- Base ----
FROM node:20-slim AS base
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/web/package.json apps/web/package.json
RUN npm ci

# ---- Builder ----
FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
# Produce the self-contained standalone server output for the runner stage.
ENV BUILD_STANDALONE=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build:prod --workspace apps/web

# ---- Runner ----
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# Use the distro Chromium for headless screenshots.
ENV CHROME_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_DOWNLOAD=1

# Chromium + the fonts/libraries it needs to render pages headlessly.
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    fonts-noto-color-emoji \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Run as an unprivileged user.
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# Next.js standalone output (mirrors the monorepo layout via outputFileTracingRoot).
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
