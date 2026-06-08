# DET — Project Overview

Daily Expense Tracker. A single Next.js full-stack app at the repo root
serves the **admin web panel** and the **REST API**; a Flutter app
(`mobile-app/`) is the end-user client. MongoDB is the single source of
truth.

> This is the high-level map. For deeper references see
> [`ARCHITECTURE.md`](./ARCHITECTURE.md), [`DB_SCHEMA.md`](./DB_SCHEMA.md),
> [`TESTING.md`](./TESTING.md), [`DEPLOYMENT.md`](./DEPLOYMENT.md),
> [`RUNBOOK.md`](./RUNBOOK.md), [`ROADMAP.md`](./ROADMAP.md),
> and [`../mobile-app/RELEASE.md`](../mobile-app/RELEASE.md).

---

## 1. At a glance

| Layer            | Stack                                                                         |
| ---------------- | ----------------------------------------------------------------------------- |
| API + Admin UI   | Next.js 14 (App Router), React 18, Tailwind CSS                               |
| Server runtime   | Node.js ≥ 18.17, Mongoose 8                                                   |
| Database         | MongoDB (Atlas in prod, local mongod in dev, `mongodb-memory-server` in test) |
| Auth             | JWT (access 15m + refresh 30d, rotation + reuse detection), bcryptjs (12)     |
| Validation       | Joi (`lib/validators/*`)                                                      |
| Logging          | Winston                                                                       |
| Email            | Nodemailer (optional dep, SMTP via env)                                       |
| Background jobs  | Vercel cron (`/api/cron/recurring`)                                           |
| Observability    | Sentry stub (`lib/observability/sentry.js`), Winston + structured logs        |
| Mobile client    | Flutter 3.19+, Dart 3.3+, Riverpod, GoRouter, Dio, fl_chart, Sentry Flutter   |
| Tests (server)   | Jest + `mongodb-memory-server`; Playwright admin E2E                          |
| Tests (mobile)   | `flutter_test` widget tests                                                   |
| Deploy           | Docker (multi-stage), GitHub Actions → GHCR; Vercel/Render/Fly/k8s supported  |

---

## 2. Repo layout

```
C:\DET\
├─ app/                       # Next.js App Router
│  ├─ api/                    # REST endpoints + cron
│  │  ├─ health/route.js
│  │  ├─ cron/recurring/route.js
│  │  └─ v1/
│  │     ├─ auth/...          # register, login, refresh, logout, *-password
│  │     ├─ users/me/
│  │     ├─ expenses/         # CRUD + [id]
│  │     ├─ categories/       # CRUD + [id]
│  │     ├─ dashboard/        # summary
│  │     ├─ reports/          # daily, weekly, monthly, yearly, category-breakdown, trends
│  │     ├─ budgets/          # CRUD + status
│  │     ├─ recurring/        # CRUD + [id]
│  │     ├─ notifications/    # list, unread-count, mark-read, mark-all-read
│  │     └─ admin/            # dashboard, users, categories, subscriptions, notifications/broadcast,
│  │                          #   audit-log, session (cookie auth)
│  ├─ admin/                  # Admin web UI (App Router pages)
│  │  ├─ login/page.js
│  │  └─ (protected)/         # gated by middleware.js + requireAdmin()
│  │     ├─ layout.js         # AdminShell wraps every protected page
│  │     ├─ page.js           # dashboard
│  │     ├─ users/, categories/, subscriptions/, notifications/, audit-log/
│  └─ layout.js, page.js
│
├─ components/admin/          # Admin client components (tables, charts, forms)
├─ middleware.js              # Protects /admin/**
│
├─ lib/                       # All server-side logic (handlers stay thin)
│  ├─ api/
│  │  ├─ withRoute.js         # The one wrapper for every route (see §4)
│  │  ├─ auth.js              # requireAuth / requireRole
│  │  ├─ auditLog.js          # withAudit composer (admin mutations)
│  │  ├─ validate.js, cors.js, rateLimit.js
│  ├─ admin/                  # session.js (cookie JWT), serverAuth.js (requireAdmin in RSC)
│  ├─ models/                 # Mongoose models (User, Category, Expense, Budget,
│  │                          #   RecurringExpense, Notification, Subscription,
│  │                          #   RefreshToken, AuditLog)
│  ├─ services/               # Business logic — auth, user, category, expense,
│  │                          #   budget, recurring, notification, analytics,
│  │                          #   admin, audit
│  ├─ validators/             # Joi schemas
│  ├─ utils/                  # ApiError, ApiResponse, jwt, mailer, pagination, logger, ms
│  ├─ config/                 # env.js, constants.js
│  ├─ observability/          # sentry.js (no-op until SENTRY_DSN is set)
│  └─ db.js                   # HMR-safe Mongoose connection
│
├─ mobile-app/                # Flutter client (see §7)
│  ├─ lib/
│  │  ├─ main.dart, app.dart
│  │  ├─ core/                # router, api_client, token_storage, theme, env, format, tokens
│  │  ├─ shared/              # theme_mode_provider, common widgets
│  │  └─ features/
│  │     ├─ auth/             # login, register, forgot-password + auth_controller
│  │     ├─ home/             # bottom-nav shell
│  │     ├─ dashboard/        # summary cards + analytics screen
│  │     ├─ expenses/         # list + add-expense bottom sheet
│  │     ├─ categories/       # manage user categories (icon + color picker)
│  │     ├─ budgets/          # progress rings, alert banner
│  │     ├─ recurring/        # schedule recurring expenses
│  │     ├─ analytics/        # fl_chart pie + bar/line
│  │     ├─ notifications/    # bell + list
│  │     └─ profile/
│  ├─ test/                   # widget tests (auth, expenses)
│  └─ pubspec.yaml
│
├─ tests/                     # Jest — services + withRoute + admin E2E
├─ e2e/admin/                 # Playwright admin specs
├─ scripts/                   # seed, create-admin, db-check, index-audit, loadtest/dashboard.js (k6)
├─ docs/                      # ARCHITECTURE, DB_SCHEMA, ROADMAP, TESTING, DEPLOYMENT, RUNBOOK, OVERVIEW
├─ Dockerfile, docker-compose.yml, .dockerignore
├─ next.config.mjs            # standalone output, security headers, bundle-analyzer hook
├─ jsconfig.json              # @/* path alias → repo root
├─ playwright.config.js
├─ vercel.json                # cron schedule
└─ package.json
```

---

## 3. Languages & key dependencies

**Backend / Web (Node):**
- `next@14`, `react@18`, `mongoose@8`, `jsonwebtoken`, `bcryptjs`, `joi`, `winston`
- Dev: `jest`, `mongodb-memory-server`, `@playwright/test`, `tailwindcss`, `@next/bundle-analyzer`
- Optional: `nodemailer`

**Mobile (Flutter / Dart):**
- `flutter_riverpod`, `go_router`, `dio`, `flutter_secure_storage`, `shared_preferences`,
  `intl`, `fl_chart`, `sentry_flutter`
- Build-time: `flutter_launcher_icons`, `flutter_native_splash`, `image`

---

## 4. Backend request lifecycle (the `withRoute` contract)

Every API route in `app/api/**/route.js` is a thin handler wrapped by
`lib/api/withRoute.js`. The wrapper does, in order:

1. **CORS preflight** — short-circuit `OPTIONS` with allowlist headers.
2. **Rate limit** — per `(IP, bucket)`. Default 300 / 15 min; `auth` bucket 20 / 15 min.
3. **DB connect** — HMR-safe Mongoose pool (skipped via `{ skipDb: true }`).
4. **Body parse + sanitize** — strip `$`-prefixed and dotted keys (Mongo injection guard).
5. **Joi validate** — `body / query / params` per route's `schema`.
6. **Auth** — `requireAuth(req)` (Bearer JWT or admin session cookie); `requireRole` if `auth: 'admin'`.
7. **Handler** — receives `{ req, body, query, params, user, ip, userAgent, origin }`, returns a value or `Response`.
8. **Response envelope + CORS stamp** — wraps non-Response returns into `NextResponse.json(...)`.
9. **Error → JSON envelope** — `ApiError`, Mongoose `ValidationError/CastError`, dup key 11000, JWT errors all mapped to the standard envelope (see [`ARCHITECTURE.md`](./ARCHITECTURE.md#response-envelope)).

Admin mutations additionally compose `withAudit(handler, { action, target, before, after, meta })`
inside `withRoute` to write fire-and-forget rows to the `AuditLog` collection.

### Service layering

```
route.js  →  service (lib/services/*)  →  model (lib/models/*)  →  MongoDB
```

Handlers never `import 'mongoose'` directly; they pull behavior from
`lib/services/*`. This keeps validation/auth concerns out of business
logic and makes services Jest-testable against `mongodb-memory-server`.

---

## 5. Data model

Nine Mongoose collections (see [`DB_SCHEMA.md`](./DB_SCHEMA.md) for full field references):

```
User (1) ──< Category    (custom + shared defaults where user=null)
 │ │
 │ ├──< Expense >── Category
 │ ├──< Budget  >── Category   (null category = overall budget)
 │ ├──< RecurringExpense >── Category
 │ ├──< Notification           (user=null = broadcast)
 │ ├──< RefreshToken           (hashed, jti-tracked, TTL-purged)
 │ └─── Subscription           (1:1)
AuditLog                       (admin actor + target snapshot — append-only)
```

**Soft delete contract:** every user-owned collection has `deletedAt: Date | null`; list queries filter `{ deletedAt: null }`; hard purge runs 90 days after soft delete.

**Cross-model invariants:**
- Deleting a `Category` referenced by undeleted `Expense`s requires `?force=true` and reassigns expenses to the user's "Other".
- Materializing a `RecurringExpense` creates an `Expense` (`recurringSource=recurring._id`) and atomically advances `nextRunAt`.
- Crossing a `Budget.alertThreshold` creates a `Notification(type='budget_alert')` and sets `alertSentAt`.

---

## 6. API surface (v1)

Grouped by area. Full URL prefix is `/api/v1/`. Auth column: `public`, `user` (Bearer JWT), `admin` (admin session cookie OR admin Bearer).

| Group           | Method | Path                                     | Auth   |
| --------------- | ------ | ---------------------------------------- | ------ |
| Auth            | POST   | `auth/register`                          | public |
|                 | POST   | `auth/login`                             | public |
|                 | POST   | `auth/refresh`                           | public |
|                 | POST   | `auth/logout`                            | public |
|                 | POST   | `auth/forgot-password`                   | public |
|                 | POST   | `auth/reset-password`                    | public |
|                 | POST   | `auth/change-password`                   | user   |
| Profile         | GET    | `users/me`                               | user   |
|                 | PATCH  | `users/me`                               | user   |
| Expenses        | GET    | `expenses` *(search/filter/sort/paginate)* | user |
|                 | POST   | `expenses`                               | user   |
|                 | GET    | `expenses/:id`                           | user   |
|                 | PATCH  | `expenses/:id`                           | user   |
|                 | DELETE | `expenses/:id` *(soft)*                  | user   |
| Categories      | GET    | `categories` *(merged user + defaults)*  | user   |
|                 | POST   | `categories`                             | user   |
|                 | PATCH  | `categories/:id`                         | user   |
|                 | DELETE | `categories/:id?force=true`              | user   |
| Dashboard       | GET    | `dashboard`                              | user   |
| Reports         | GET    | `reports/daily \| weekly \| monthly \| yearly` | user |
|                 | GET    | `reports/category-breakdown`             | user   |
|                 | GET    | `reports/trends`                         | user   |
| Budgets         | GET    | `budgets`                                | user   |
|                 | POST   | `budgets`                                | user   |
|                 | PATCH  | `budgets/:id`                            | user   |
|                 | DELETE | `budgets/:id`                            | user   |
|                 | GET    | `budgets/status`                         | user   |
| Recurring       | GET    | `recurring`                              | user   |
|                 | POST   | `recurring`                              | user   |
|                 | PATCH  | `recurring/:id`                          | user   |
|                 | DELETE | `recurring/:id`                          | user   |
| Notifications   | GET    | `notifications`                          | user   |
|                 | GET    | `notifications/unread-count`             | user   |
|                 | PATCH  | `notifications/:id/read`                 | user   |
|                 | POST   | `notifications/mark-all-read`            | user   |
| Admin (cookie)  | POST   | `admin/session` *(login)*                | public |
|                 | DELETE | `admin/session` *(logout)*               | admin  |
|                 | GET    | `admin/dashboard`                        | admin  |
|                 | GET    | `admin/users`, `admin/users/:id`         | admin  |
|                 | PATCH  | `admin/users/:id` *(status)* — audited   | admin  |
|                 | GET    | `admin/categories`                       | admin  |
|                 | POST   | `admin/categories` — audited             | admin  |
|                 | PATCH  | `admin/categories/:id` — audited         | admin  |
|                 | DELETE | `admin/categories/:id` — audited         | admin  |
|                 | POST   | `admin/notifications/broadcast` — audited | admin  |
|                 | GET    | `admin/subscriptions`                    | admin  |
|                 | GET    | `admin/audit-log`                        | admin  |
| Ops             | GET    | `/api/health`                            | public |
|                 | POST   | `/api/cron/recurring` (CRON_SECRET)      | cron   |

Response envelope (success / error) is documented in [`ARCHITECTURE.md`](./ARCHITECTURE.md#response-envelope).

---

## 7. Web flow — Admin Panel

Routes live under `app/admin/`:

```
/admin/login                  →  app/admin/login/page.js
  ↓  POSTs to /api/v1/admin/session
  ↓  server sets httpOnly cookie (signed admin JWT, see lib/admin/session.js)
middleware.js                 →  redirects /admin/** without the cookie back to /login
/admin/(protected)/layout.js  →  requireAdmin() in a Server Component → AdminShell
  ├─ /                        →  dashboard (server-fetched stats + custom Tailwind charts)
  ├─ /users                   →  paginated user table; block/activate triggers PATCH
  ├─ /categories              →  default-category CRUD
  ├─ /subscriptions           →  read-only overview
  ├─ /notifications           →  broadcast form
  └─ /audit-log               →  paginated admin action history
```

Patterns used:
- **RSC for reads** (server-fetch + render server-side).
- **Client Components** for tables, forms, modals — they call `/api/v1/admin/*` directly. The admin session cookie is also accepted by `withRoute` (see `lib/api/auth.js`), so client mutations work without a Bearer token.
- **Audit logging** is wrapped around every admin mutation via `withAudit` in `lib/api/auditLog.js` and surfaced at `/admin/audit-log`.

---

## 8. Mobile flow — Flutter app

Entry: `mobile-app/lib/main.dart` → `DetApp` (in `app.dart`) → `routerProvider` (`core/router.dart`).

```
SentryFlutter.init (no-op until SENTRY_DSN dart-define is set)
  └─ runApp(ProviderScope(DetApp))
     └─ MaterialApp.router(theme + dark mode, routerProvider)
        └─ GoRouter
            redirect:
              not logged in & not auth route → /login
              logged in & auth route         → /
            routes:
              /login, /register, /forgot-password   (auth screens)
              /            HomeShell                (bottom nav)
              /categories, /budgets, /recurring, /notifications
```

`HomeShell` is the bottom-navigation container with tabs for Dashboard,
Expenses, Analytics, Profile. The Add-Expense FAB opens a bottom sheet
that POSTs `/api/v1/expenses`.

**Architecture inside `lib/features/<feature>/`:**

```
data/         models (DTOs) + *_api.dart    (Dio calls, JSON ⇄ Dart)
application/  *_controller.dart             (Riverpod StateNotifier — feature state)
presentation/ screens + widgets             (Riverpod-consuming Material 3 widgets)
```

Shared plumbing (`lib/core/`):
- `api_client.dart` — Dio instance with Bearer interceptor + 401 → refresh-token retry.
- `token_storage.dart` — `flutter_secure_storage` for access/refresh tokens.
- `env.dart` — `dart-define` config (API base URL, Sentry DSN, app release).
- `theme.dart` — Material 3 seed `#5B7CFA`, dark/light schemes.

Charts via `fl_chart` (pie + line/bar). Theme mode is persisted in
`shared_preferences` (`shared/theme_mode_provider.dart`).

---

## 9. Auth flow (end-to-end)

```
Mobile/Web client                Server (withRoute)                MongoDB
──────────────────                ──────────────────                ───────
1. POST /auth/login          →  auth.service.login                User.findOne(email)
   { email, password }          validate, compare bcrypt          → check status=active
                                sign access (15m) + refresh (30d)
                                hash refresh, store with jti      RefreshToken.create
                             ←  { user, access, refresh }

2. GET /v1/...               →  requireAuth: verify access JWT
   Authorization: Bearer        → ctx.user
                             ←  data

3. Access token expires
   POST /auth/refresh        →  auth.service.refresh
   { refresh }                  verify signature, lookup jti
                                if jti reused → revoke family,    RefreshToken.updateMany
                                  return 401                        ({ family }, revoked)
                                else rotate: issue new pair,
                                  mark old revoked
                             ←  { access, refresh }

4. POST /auth/logout         →  revoke jti family
                             ←  204

Admin web flow:
POST /api/v1/admin/session   →  same login flow, role=admin only
                                signAdminSession() → httpOnly cookie
                                middleware.js gates /admin/**
                                requireAdmin() in RSC layout
```

Password reset uses a hashed token in `User.passwordResetToken` (TTL `RESET_TOKEN_EXPIRES_IN`, default 15m) with no email-enumeration leakage on `/forgot-password`.

---

## 10. Background work

- **Recurring materialization** — `app/api/cron/recurring/route.js`.
  Triggered by Vercel cron (`vercel.json`), guarded by `CRON_SECRET`.
  Finds `RecurringExpense` rows with `nextRunAt <= now && isActive`,
  creates a backing `Expense`, advances `nextRunAt` by `(frequency × interval)`.
- **Budget threshold notifications** — emitted in-app by
  `lib/services/budget.service.js` when a mutation crosses the threshold; the
  notification doc has `alertSentAt` set so it fires once per period.

---

## 11. Configuration

Backend env (via `.env.local` / deploy env — read in `lib/config/env.js`):
`MONGO_URI`, `JWT_ACCESS_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_SECRET`,
`JWT_REFRESH_EXPIRES_IN`, `RESET_TOKEN_EXPIRES_IN`, `BCRYPT_SALT_ROUNDS`,
`CORS_ORIGINS`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`, `LOG_LEVEL`,
`SMTP_*` + `MAIL_FROM`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`,
optional `SENTRY_DSN`.

Mobile build config (via `--dart-define` at `flutter build`): `API_BASE_URL`,
`SENTRY_DSN`, `APP_RELEASE`, `APP_ENV`.

---

## 12. Testing, build, deploy

- **Server tests:** `npm test` — Jest, `mongodb-memory-server`, no system Mongo needed. See [`TESTING.md`](./TESTING.md).
- **Admin E2E:** `npm run e2e` — Playwright (`e2e/admin/*.spec.js`), gated DB-backed flow.
- **Mobile tests:** `cd mobile-app && flutter test` — widget tests in `mobile-app/test/`.
- **Load test:** `npm run loadtest:dashboard` — k6, p95 < 300ms / errors < 1% thresholds.
- **Index drift report:** `npm run audit:indexes`.
- **Bundle size:** `npm run analyze` (lazy-loads `@next/bundle-analyzer`).
- **Build/Run:** `npm run dev` (HMR) / `npm run build && npm start` (standalone). Docker via `docker compose up`.
- **CI:** `.github/workflows/ci.yml` — lint → test → build, then build & push to GHCR on main.
- **Mobile release:** see [`../mobile-app/RELEASE.md`](../mobile-app/RELEASE.md).
- **Production deploy + on-call:** [`DEPLOYMENT.md`](./DEPLOYMENT.md) and [`RUNBOOK.md`](./RUNBOOK.md).

---

## 13. Status & open follow-ups

All ten roadmap phases are marked done (see [`ROADMAP.md`](./ROADMAP.md)). One follow-up remains:

- **FCM push delivery** — device tokens persist on the user doc, but no provider dispatch is wired yet. This is the prerequisite to push-on-threshold for budget alerts (Phase 6) and Phase 7's push notifications.
