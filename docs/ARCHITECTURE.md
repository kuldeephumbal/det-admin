# DET — System Architecture

One Next.js app serves the admin UI and the REST API. The Flutter
mobile app is a client of the same `/api/v1/*` endpoints.

## High-level diagram

```
                        ┌──────────────────────────────┐
                        │   Next.js (app/) — one app   │
                        │ ──────────────────────────── │
 ┌────────────────┐     │  Admin UI       app/(pages)  │
 │ Flutter Mobile │─────▶ ───────────────────────────  │
 │ (Material 3,   │ HTTPS│  REST API   app/api/v1/**   │
 │  Riverpod)     │ JWT  │ ──────────────────────────  │
 └────────────────┘     │  Shared logic   lib/**       │
                        └──────────────┬───────────────┘
                                       │ Mongoose
                              ┌────────▼────────┐
                              │     MongoDB     │
                              └─────────────────┘
```

## Layering

```
HTTP request
    │
    ▼
[ Next.js routing → app/api/v1/.../route.js ]
    │
    ▼
[ withRoute(handler, options) — wraps the handler:
    · ensures DB connection (HMR-safe)
    · CORS headers
    · in-memory rate limit per (IP, bucket)
    · JSON sanitize ($-key / dotted-key strip)
    · Joi validation (body / query / params)
    · Bearer JWT auth + role check
    · centralized error → JSON envelope
]
    │
    ▼
[ handler ]   ← thin: read context (body/query/user), call service, format response
    │
    ▼
[ service ]   ← business logic, cross-model orchestration  (lib/services/*)
    │
    ▼
[ model ]     ← Mongoose schema + statics/methods           (lib/models/*)
    │
    ▼
   MongoDB
```

`handler` files in `app/api/v1/**/route.js` never import `mongoose` directly.
Models, services, validators, and utils all live in `lib/`.

## Data model (ERD)

```
User (1) ────< Category   (custom categories, plus shared defaults where user=null)
 │   │
 │   ├─< Expense >── Category
 │   ├─< Budget   >── Category (optional — null = overall monthly budget)
 │   ├─< RecurringExpense >── Category
 │   ├─< Notification
 │   ├─< RefreshToken  (auth session, hashed + jti, TTL-purged)
 │   └─── Subscription (1:1)
```

See `DB_SCHEMA.md` for full field references.

## Multi-tenancy & data isolation

- Every list/get/update/delete on user-owned data **must** filter by
  `user: ctx.user.id`. Never accept a `userId` from request bodies.
- The `withRoute({ auth: true })` wrapper resolves `ctx.user` from the
  Bearer token and verifies the user is `active`. Admin endpoints use
  `{ auth: 'admin' }`.

## API surface (final, by phase)

| Method  | Path                                  | Phase | Auth        |
| ------- | ------------------------------------- | ----- | ----------- |
| POST    | /api/v1/auth/register                 | 2     | public      |
| POST    | /api/v1/auth/login                    | 2     | public      |
| POST    | /api/v1/auth/refresh                  | 2     | public      |
| POST    | /api/v1/auth/logout                   | 2     | public      |
| POST    | /api/v1/auth/forgot-password          | 2     | public      |
| POST    | /api/v1/auth/reset-password           | 2     | public      |
| POST    | /api/v1/auth/change-password          | 2     | user        |
| GET     | /api/v1/users/me                      | 2     | user        |
| PATCH   | /api/v1/users/me                      | 2     | user        |
| POST    | /api/v1/expenses                      | 3     | user        |
| GET     | /api/v1/expenses                      | 3     | user        |
| GET     | /api/v1/expenses/:id                  | 3     | user        |
| PATCH   | /api/v1/expenses/:id                  | 3     | user        |
| DELETE  | /api/v1/expenses/:id                  | 3     | user        |
| GET     | /api/v1/categories                    | 4     | user        |
| POST    | /api/v1/categories                    | 4     | user        |
| PATCH   | /api/v1/categories/:id                | 4     | user        |
| DELETE  | /api/v1/categories/:id                | 4     | user        |
| GET     | /api/v1/dashboard                     | 5     | user        |
| GET     | /api/v1/reports/daily                 | 5     | user        |
| GET     | /api/v1/reports/weekly                | 5     | user        |
| GET     | /api/v1/reports/monthly               | 5     | user        |
| GET     | /api/v1/reports/yearly                | 5     | user        |
| GET     | /api/v1/reports/category-breakdown    | 5     | user        |
| GET     | /api/v1/reports/trends                | 5     | user        |
| GET     | /api/v1/budgets                       | 6     | user        |
| POST    | /api/v1/budgets                       | 6     | user        |
| PATCH   | /api/v1/budgets/:id                   | 6     | user        |
| DELETE  | /api/v1/budgets/:id                   | 6     | user        |
| GET     | /api/v1/budgets/status                | 6     | user        |
| GET     | /api/v1/recurring                     | 7     | user        |
| POST    | /api/v1/recurring                     | 7     | user        |
| PATCH   | /api/v1/recurring/:id                 | 7     | user        |
| DELETE  | /api/v1/recurring/:id                 | 7     | user        |
| GET     | /api/v1/notifications                 | 7     | user        |
| PATCH   | /api/v1/notifications/:id/read        | 7     | user        |
| POST    | /api/v1/notifications/mark-all-read   | 7     | user        |
| GET     | /api/v1/admin/dashboard               | 8     | admin       |
| GET     | /api/v1/admin/users                   | 8     | admin       |
| PATCH   | /api/v1/admin/users/:id/block         | 8     | admin       |
| PATCH   | /api/v1/admin/users/:id/activate      | 8     | admin       |
| GET     | /api/v1/admin/categories              | 8     | admin       |
| POST    | /api/v1/admin/categories              | 8     | admin       |
| POST    | /api/v1/admin/notifications/broadcast | 8     | admin       |
| GET     | /api/v1/admin/subscriptions           | 8     | admin       |

## Response envelope

```jsonc
// Success
{
  "success": true,
  "message": "OK",
  "data": { ... },
  "meta": { "pagination": { "page": 1, "limit": 20, "total": 87, "totalPages": 5, "hasNext": true, "hasPrev": false } }
}

// Error
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [{ "field": "amount", "message": "must be a positive number", "location": "body" }]
  }
}
```

## Security

- Bcrypt (12 rounds) for passwords; `select:false` so they never leak.
- JWT access (short-lived, 15m) + refresh (30d, hashed + jti-tracked in `RefreshToken`).
  Rotation on use; reuse of a revoked token revokes the entire token family.
- Security headers via `next.config.mjs` `headers()`: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
- CORS allowlist from env.
- JSON sanitize on input: strip `$`-prefixed and dotted keys before validation.
- Rate limits per IP + bucket. `auth` bucket = 20 / 15 min; default = 300 / 15 min.
- Auth status check on every request — blocked/deleted users rejected.

## Performance & scaling notes

- Compound indexes on `(user, date desc)` and `(user, category, date desc)` for expense reads.
- Dashboard totals via Mongo `$group` aggregations, not in app memory.
- Pagination defaults: 20, max 100.
- HMR-safe Mongoose connection — single pool reused across hot reloads.
- `mongoose`/`bcryptjs`/`winston`/`nodemailer` listed in
  `serverComponentsExternalPackages` so they stay Node-only and don't get bundled into the client.
- Cron-driven jobs (recurring materialization, scheduled notifications) — Phase 7 will choose between:
  - A separate Node worker process (development & self-hosted)
  - Vercel cron / Render cron jobs (serverless deploy)
