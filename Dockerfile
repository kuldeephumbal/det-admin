# syntax=docker/dockerfile:1.7
#
# Multi-stage build of the Next.js full-stack app.
#   - `deps`    installs node_modules with cached dependency layer
#   - `builder` runs `next build` (emits .next/standalone)
#   - `runner`  minimal Alpine image, non-root, runs the standalone server
#
# Final image size: ~150MB. CMD listens on $PORT (default 3000).

ARG NODE_VERSION=20.14.0

# ---- deps ------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app

# libc6-compat covers a few Node native modules (mongoose, bcryptjs) on Alpine.
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json* ./
# Install with --ignore-scripts so postinstall scripts (e.g. mongodb-memory-server
# binary download) don't pull anything we don't need at runtime.
RUN if [ -f package-lock.json ]; then \
      npm ci --ignore-scripts --no-audit --no-fund; \
    else \
      npm install --ignore-scripts --no-audit --no-fund; \
    fi

# ---- builder ---------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# next.config.mjs sets `output: 'standalone'`, so this produces
# .next/standalone and .next/static which we copy below.
RUN npm run build

# ---- runner ----------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Standalone bundle pulls in the minimum runtime deps. We then copy the
# public/ folder and the static client assets next to it.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# Healthcheck — same endpoint that Render/Fly/k8s probes hit.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:${PORT}/api/health || exit 1

CMD ["node", "server.js"]
