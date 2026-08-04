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
ENV PUPPETEER_SKIP_DOWNLOAD=1
ENV NEXT_TELEMETRY_DISABLED=1
# Chromium needs a writable home for crashpad / profile dirs inside the
# container. Cloud Run's /tmp is the only reliably writable path.
ENV HOME=/tmp
ENV XDG_CONFIG_HOME=/tmp/.chromium
ENV XDG_CACHE_HOME=/tmp/.chromium
# Disable crashpad pipe so a crash doesn't cascade into "database required".
ENV CHROME_DEVEL_SANDBOX=/usr/lib/chromium/chrome-sandbox

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    fonts-noto-color-emoji \
    fonts-noto-cjk \
    ca-certificates \
    dbus \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxshmfence1 \
    libpango-1.0-0 \
    libnss3 \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /tmp/.chromium \
  && chmod 777 /tmp/.chromium \
  && (test -x /usr/lib/chromium/chromium && ln -sf /usr/lib/chromium/chromium /usr/local/bin/chromium-bin || true) \
  && chromium --version \
  && (test -x /usr/lib/chromium/chromium && /usr/lib/chromium/chromium --version || true)

# Prefer the real Chromium binary over the Debian wrapper script when present.
ENV CHROME_EXECUTABLE_PATH=/usr/lib/chromium/chromium

COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci --omit=dev --workspace @cro/api --workspace @cro/shared --include-workspace-root

COPY apps/api ./apps/api
COPY packages/shared ./packages/shared

# Run as root in the container. Cloud Run already sandbox-isolates the
# instance; Chromium is unreliable as a locked-down non-root user here
# (crashpad + sandbox paths). --no-sandbox is still set in launch args.
EXPOSE 8080

WORKDIR /app/apps/api
CMD ["npx", "tsx", "src/index.ts"]
