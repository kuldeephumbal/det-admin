# DET — Daily Expense Tracker

A premium, production-grade daily expense tracking platform.

One Next.js app houses both the admin panel UI and the REST API.
The Flutter mobile app talks to the same `/api/v1` endpoints.

## Stack

| Layer            | Technology                                              |
| ---------------- | ------------------------------------------------------- |
| Web (admin + API)| Next.js 14 (App Router) + TailwindCSS                   |
| API runtime      | Next.js Route Handlers (`app/api/v1/**/route.js`)       |
| Mobile App       | Flutter (Material 3, Riverpod) — Android + iOS          |
| Database         | MongoDB (Mongoose ODM)                                  |
| Auth             | JWT (access + refresh, rotation + revocation)           |

## Repository layout

```
DET/
├── app/                # Next.js App Router
│   ├── api/v1/         # REST API (auth, users, …)
│   ├── admin/          # Admin panel UI (Phase 8 builds out)
│   ├── layout.js
│   ├── page.js         # Landing
│   └── globals.css
├── lib/                # Shared, framework-agnostic code
│   ├── config/         # env.js, constants.js
│   ├── db.js           # HMR-safe Mongoose connection
│   ├── models/         # User, Category, Expense, Budget, Recurring, Notification, Subscription, RefreshToken
│   ├── services/       # Business logic (auth, user, …)
│   ├── utils/          # ApiError, ApiResponse, jwt, mailer, logger, pagination, ms
│   ├── validators/     # Joi schemas per resource
│   └── api/            # Route Handler helpers (withRoute, auth, validate, cors, rateLimit)
├── components/         # Shared React components (Phase 8+)
├── scripts/
│   └── seed.js         # Seed default categories
├── public/
├── mobile-app/         # Flutter app (Phase 3+)
├── docs/               # ARCHITECTURE.md, ROADMAP.md, DB_SCHEMA.md
├── package.json
├── next.config.mjs
├── jsconfig.json
├── tailwind.config.js
└── postcss.config.js
```

## Quick start

```bash
cp .env.example .env.local       # then edit values
npm install
npm run seed                     # one-time — insert 8 default categories
npm run dev                      # http://localhost:3000
```

| Endpoint                       | Purpose                                |
| ------------------------------ | -------------------------------------- |
| `GET  /`                       | Landing page                           |
| `GET  /admin/login`            | Admin sign-in (Phase 8 builds dashboard)|
| `GET  /api/health`             | Health check                           |
| `GET  /api/v1`                 | API root                               |
| `POST /api/v1/auth/register`   | Create account                         |
| `POST /api/v1/auth/login`      | Sign in                                |
| `POST /api/v1/auth/refresh`    | Rotate tokens                          |
| `POST /api/v1/auth/logout`     | Revoke refresh token                   |
| `POST /api/v1/auth/forgot-password` | Send reset email                  |
| `POST /api/v1/auth/reset-password`  | Apply new password                |
| `POST /api/v1/auth/change-password` | Change password (auth required)   |
| `GET  /api/v1/users/me`        | Current user                           |
| `PATCH /api/v1/users/me`       | Update profile / preferences           |

## Roadmap

| Phase | Scope                                          | Status        |
| ----- | ---------------------------------------------- | ------------- |
| 1     | Backend architecture & DB design               | Done          |
| 2     | Authentication APIs (JWT)                      | Done          |
| 3     | Expense management APIs + Flutter shell        | Done          |
| 4     | Categories APIs + UI                           | Done          |
| 5     | Dashboard & analytics                          | Done          |
| 6     | Budget management                              | Done          |
| 7     | Recurring expenses + notifications             | Done          |
| 8     | Admin panel build-out (Next.js)                | Done          |
| 9     | Testing, hardening, optimization               | Done          |
| 10    | Production deployment                          | Done          |

See `docs/ARCHITECTURE.md` for the system architecture and ERD, and
`docs/ROADMAP.md` for per-phase deliverables.
