


# DET — Development Roadmap

10-phase plan. One Next.js app at the repo root holds both the
admin UI and the REST API consumed by the Flutter mobile app.

## Phase 1 — Backend Architecture & DB Design *(done)*

- [x] Next.js full-stack scaffold at repo root (no separate backend folder)
- [x] HMR-safe Mongoose connection
- [x] All 8 Mongoose models (incl. RefreshToken)
- [x] `withRoute` wrapper — DB ensure, CORS, rate-limit, body-sanitize, Joi validate, auth + role, error → JSON envelope
- [x] JWT utilities (access + refresh, jti tracking)
- [x] Joi validators
- [x] Winston logger
- [x] Seed script for default categories
- [x] `/api/health` endpoint
- [x] Architecture doc, ERD, API surface map

## Phase 2 — Authentication APIs *(done)*

- [x] `POST /api/v1/auth/register`
- [x] `POST /api/v1/auth/login`
- [x] `POST /api/v1/auth/refresh` — rotation with reuse detection
- [x] `POST /api/v1/auth/logout`
- [x] `POST /api/v1/auth/forgot-password` (no enumeration)
- [x] `POST /api/v1/auth/reset-password`
- [x] `POST /api/v1/auth/change-password`
- [x] `GET /api/v1/users/me`, `PATCH /api/v1/users/me`
- [x] Admin login stub at `/admin/login`

## Phase 3 — Expense Management + Flutter shell *(done)*

Backend:
- [x] CRUD `/api/v1/expenses` (+ `[id]` route)
- [x] Search (text on note), filters (date range, category, payment method, amount range), sort, pagination
- [x] Soft delete

Flutter (under `mobile-app/`):
- [x] App scaffold with Riverpod, GoRouter, Material 3 theming, dark mode
- [x] Auth screens (login, register, forgot password)
- [x] Home shell with bottom nav
- [x] Add Expense flow (FAB → bottom sheet → save)
- [x] Expense list with infinite scroll

## Phase 4 — Categories *(done)*

- [x] `GET /api/v1/categories` (user's + defaults merged)
- [x] `POST /api/v1/categories` — custom (icon + color picker on mobile)
- [x] `PATCH /api/v1/categories/:id`, `DELETE /api/v1/categories/:id` (soft; refuses if in use unless `force`)
- [x] Category management screen in app

## Phase 5 — Dashboard & Analytics *(done)*

- [x] `GET /api/v1/dashboard` — totals, remaining budget, recent expenses, top categories
- [x] `GET /api/v1/reports/{daily|weekly|monthly|yearly}` — bucketed series
- [x] `GET /api/v1/reports/category-breakdown` — pie data
- [x] `GET /api/v1/reports/trends` — line/bar trend data
- [x] Mongo aggregation pipelines
- [x] Flutter: dashboard cards, fl_chart pie + bar widgets

## Phase 6 — Budget Management *(done)*

- [x] CRUD `/api/v1/budgets` (overall + per-category, monthly or yearly)
- [x] `GET /api/v1/budgets/status` — used/remaining per active budget
- [x] Overspending detection — emits in-app notification when threshold crossed
- [x] Flutter: budget setup, progress rings, alert banner
- [ ] Push notification on threshold (depends on Phase 7 FCM)

## Phase 7 — Recurring Expenses + Notifications *(done)*

Recurring:
- [x] CRUD `/api/v1/recurring`
- [x] Scheduled worker via Vercel cron route `app/api/cron/recurring/route.js` —
      finds `nextRunAt <= now && isActive`, materializes Expense, advances `nextRunAt`

Notifications:
- [x] `GET /api/v1/notifications`, mark-read, mark-all-read, unread-count
- [x] Broadcast (admin) + per-user delivery
- [ ] FCM device-token storage + push delivery — still on user doc, not yet wired to a provider

## Phase 8 — Admin Panel (Next.js) *(done)*

- [x] `app/admin/(protected)/*` under App Router (dashboard, users, categories, notifications, subscriptions)
- [x] Auth: `/api/v1/admin/session` exchanges admin login for httpOnly cookie (signed JWT)
- [x] `middleware.js` protects `/admin/**`
- [x] Sidebar layout + dashboard analytics (custom Tailwind charts, not Recharts/Tremor)
- [x] Server Components for read-only data; Client Components for tables/interactive bits
- [x] User management (list, view, block, activate)
- [x] Default category management
- [x] Broadcast notifications
- [x] Subscription overview
- [x] `/api/v1/admin/*` Route Handlers using `withRoute({ auth: 'admin' })`
- [x] Audit log middleware on admin mutations — `lib/api/auditLog.js#withAudit` composes inside `withRoute`; wired on user status, default-category CRUD, and notification broadcast; surfaced via `GET /api/v1/admin/audit-log`

## Phase 9 — Testing & Optimization *(done)*

- [x] **Unified admin auth** — `withRoute` accepts the admin session cookie in addition to Bearer (fixes a 401 bug for admin Client Component mutations)
- [x] **Jest harness** with `mongodb-memory-server` — no system Mongo needed
- [x] **Service tests** — auth, expense, budget, recurring (see `tests/services/`)
- [x] **`withRoute` test** — validation, sanitize, auth, errors, CORS, OPTIONS
- [x] **HSTS** added for production responses
- [x] **`@next/bundle-analyzer`** wired in (lazy — only loads when `ANALYZE=true`)
- [x] **`scripts/index-audit.js`** — schema vs live index drift report
- [x] **`scripts/loadtest/dashboard.js`** — k6 with p95<300ms + <1% error thresholds
- [x] **`docs/TESTING.md`** — how to run, security checklist
- [x] Flutter widget tests for core flows — `mobile-app/test/auth` + `mobile-app/test/expenses` (10 tests)
- [x] Playwright admin E2E — `playwright.config.js`, `e2e/admin/*.spec.js`, CI job (login UI, middleware redirect, gated real-DB auth flow)

## Open follow-ups

- ~~**FCM push delivery**~~ ✅ — `lib/services/fcm.service.js` + `notification.service._fanOut` cover per-user push; broadcast fan-out wired in too. Flutter `PushService._showForegroundBanner` renders foreground notifications as snackbars; background/killed messages go through the system tray. Setup steps in [`PUSH_SETUP.md`](./PUSH_SETUP.md).

## Phase 10 — Production Deployment *(done)*

- [x] **Dockerfile** — multi-stage Alpine image, non-root, healthcheck on `/api/health`, runs the standalone Next bundle
- [x] **`.dockerignore`** — keeps node_modules, .next, tests, docs out of the build context
- [x] **`docker-compose.yml`** — app + mongo with healthchecks and a named volume
- [x] **`output: 'standalone'`** wired into `next.config.mjs`
- [x] **GitHub Actions CI** (`.github/workflows/ci.yml`) — lint → test → build, then build & push image to GHCR on main
- [x] **Sentry stub** (`lib/observability/sentry.js`) — no-op until `SENTRY_DSN` is set + `@sentry/node` installed
- [x] **`docs/DEPLOYMENT.md`** — Vercel, Render, Fly, k8s walkthroughs + Atlas notes + cron wiring + pre-flight checklist
- [x] **`docs/RUNBOOK.md`** — on-call signals, rollback steps, abuse mitigation, restore from backup
- [x] **`mobile-app/RELEASE.md`** — Play Store + App Store release flow, versioning, signing, hotfix flow
