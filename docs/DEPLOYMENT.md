# DET — Deployment guide

Two deploy shapes are supported out of the box:

| Shape | Use when | Pieces |
| --- | --- | --- |
| **Serverless** | You want zero ops, edge POPs, autoscaling. | Vercel (web) + MongoDB Atlas + Upstash Redis (rate-limit, Phase 10 polish) |
| **Long-running container** | You want a single image you can also run on Render/Fly/k8s | Docker image + Atlas (or self-hosted Mongo) |

Both run the same code — only the runtime envelope differs.

---

## 1. Prerequisites

- A MongoDB cluster (Atlas recommended). Whitelist the deploy IPs.
- A secret for every required env in `.env.example`. **Always rotate**
  `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CRON_SECRET` to ≥ 32 random bytes.
- For the cron worker: pick how you'll trigger it (see below).

Generate a strong random secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## 2a. Vercel (serverless)

1. Import the repo in Vercel. It auto-detects Next.js.
2. **Environment variables** — copy every key from `.env.example` into Vercel's
   project settings. `MONGO_URI` points at Atlas, `NEXT_PUBLIC_APP_URL` at the
   production URL (e.g. `https://det.app`).
3. **Cron** — `vercel.json` is already in the repo and registers
   `/api/cron/recurring` to fire every 15 minutes. Vercel automatically
   sends `Authorization: Bearer <CRON_SECRET>`; the route accepts that header.
4. **Custom domain** — add it under "Domains". HSTS will kick in on
   production responses (set in `next.config.mjs`).
5. **Limits**:
   - 10s function timeout on Hobby, 60s+ on Pro. The current cron job
     finishes in well under a second for typical workloads.
   - In-memory rate limiter is per-instance. If you scale beyond a single
     instance, swap to Upstash Redis (drop-in — `lib/api/rateLimit.js`
     is the only file to change).

## 2b. Docker (Render / Fly / k8s / self-hosted)

Build and run locally first as a sanity check:

```bash
docker compose up --build
```

You should see Mongo + the app come up, the healthcheck go green, and
`curl http://localhost:3000/api/health` return 200.

For a single-host deploy (Render, Fly, etc.):

1. Push the image: CI builds and pushes to GHCR on every commit to `main`
   (see `.github/workflows/ci.yml`). The tag `latest` always points at the
   tip of main; SHA-based tags pin a specific build.
2. Point your host at `ghcr.io/<org>/det:latest`. Required env: same as
   `.env.example`.
3. Set the healthcheck to `GET /api/health`.
4. Configure a system cron / scheduled job to hit
   `https://your-host/api/cron/recurring` every 15 minutes with the header
   `x-cron-secret: <CRON_SECRET>`.

### Render service definition (example)

```yaml
services:
  - type: web
    name: det-web
    runtime: image
    image:
      url: ghcr.io/your-org/det:latest
    healthCheckPath: /api/health
    envVars:
      - key: MONGO_URI
        sync: false
      - key: JWT_ACCESS_SECRET
        sync: false
      - key: JWT_REFRESH_SECRET
        sync: false
      - key: CRON_SECRET
        sync: false
      - key: CORS_ORIGINS
        value: https://your-domain.com
      - key: NODE_ENV
        value: production

  - type: cron
    name: det-recurring
    schedule: "*/15 * * * *"
    runtime: docker
    image:
      url: curlimages/curl:latest
    dockerCommand: curl -sf -H "x-cron-secret: $CRON_SECRET" https://det-web.onrender.com/api/cron/recurring
    envVars:
      - key: CRON_SECRET
        sync: false
```

### Fly.io

```bash
fly launch --image ghcr.io/your-org/det:latest --name det
fly secrets set MONGO_URI=... JWT_ACCESS_SECRET=... JWT_REFRESH_SECRET=... CRON_SECRET=...
fly deploy
```

For the cron, use Fly's `[deploy.strategy = "rolling"]` + a separate
`machines run --schedule` job, or any external scheduler that can curl
the endpoint.

### Kubernetes (sketch)

- `Deployment` of the image with `replicas: 2+`
- `Service` + `Ingress` with TLS termination upstream
- `Secret` carrying the env vars (mount as `envFrom`)
- `CronJob` running `curl -H "x-cron-secret: ..." https://.../api/cron/recurring` every 15m
- Liveness/readiness probes on `/api/health`
- Resource requests: 100m CPU / 256Mi memory; limits 500m / 512Mi to start

## 3. MongoDB Atlas notes

- Use a dedicated database user with `readWrite` on the `det` DB only.
- Enable **point-in-time backups** at the cluster level.
- Add the deploy egress IPs to the IP allowlist (or use VPC peering on Vercel).
- Set `maxPoolSize` no higher than `(serverless concurrency × 5)`; the app
  defaults to 50 which is fine for a small/medium fleet.

## 4. Mobile app

See `mobile-app/RELEASE.md`.

## 5. Observability

- **Logs** — Winston writes JSON to stdout in production (see
  `lib/utils/logger.js`). Pipe to your provider of choice.
- **Sentry** — set `SENTRY_DSN` and install `@sentry/node` (or `@sentry/nextjs`
  for full integration). The `lib/observability/sentry.js` module no-ops
  when DSN is unset.
- **Uptime** — point any uptime monitor at `/api/health`.
- **Dashboards** — the `monitoring/` directory is reserved for future
  Grafana dashboards.

## 6. Pre-flight checklist (run this before flipping DNS)

- [ ] `.env` set in production — every secret rotated, no dev placeholders
- [ ] `CORS_ORIGINS` lists only the real client origins (no `*`)
- [ ] HSTS header confirmed in production responses (`curl -I https://…`)
- [ ] Atlas backups on, retention ≥ 14 days
- [ ] `npm run audit:indexes` clean against production cluster
- [ ] `npm test` green on the deploy SHA
- [ ] Healthcheck wired into the host
- [ ] Cron schedule firing — `curl` the endpoint manually once to confirm
- [ ] Admin user exists in production DB
- [ ] First mobile build points at the production base URL
