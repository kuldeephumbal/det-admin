# Testing & operational scripts

## Unit / integration tests (Jest)

```bash
npm install            # picks up jest + mongodb-memory-server
npm test               # runs the whole suite, in-band
npm run test:watch     # iterative
```

Tests live under `tests/` and run against an in-memory MongoDB (no system
Mongo needed). `tests/global-setup.js` boots the in-memory cluster once and
sets the test env vars; `tests/setup.js` wipes collections between tests so
each one is hermetic.

| Path | Covers |
| --- | --- |
| `tests/services/auth.service.test.js` | register, login, refresh rotation + reuse detection, change-password |
| `tests/services/expense.service.test.js` | category ownership check, pagination, search regex escape, per-user isolation, soft delete |
| `tests/services/budget.service.test.js` | usage thresholds (ok/warning/over), per-category scoping, threshold notification fires once |
| `tests/services/recurring.service.test.js` | `advance()` for each cadence (incl. Jan 31 → Feb 28 clamp), catch-up materializer, maxOccurrences deactivation |
| `tests/api/withRoute.test.js` | Joi validation, Mongo-operator sanitize, Bearer auth, admin role enforcement, error envelope, CORS headers, OPTIONS preflight |

### Test layout

```
tests/
├── global-setup.js     # boots mongo-memory-server, sets test env
├── global-teardown.js  # stops it
├── setup.js            # per-test cleanup
├── helpers.js          # makeUser, makeAdmin, makeCategory, seedDefaultCategories
├── api/
└── services/
```

### Conventions

- Tests are `*.test.js`. Skip `.spec.js` to avoid Next's default matchers.
- Don't import `next/server` from service tests — those run pure Node logic.
- Use `await new Promise((r) => setImmediate(r))` when verifying fire-and-forget
  paths (the budget threshold notification is the example) — gives the
  microtask queue a tick to drain before assertions.

## Load testing

```bash
ACCESS_TOKEN=eyJ...your-token... API_BASE=http://localhost:3000 \
  npm run loadtest:dashboard
```

k6 ramps to 50 RPS over ~3 minutes against `GET /api/v1/dashboard`. The
thresholds (p95 < 300ms, error rate < 1%) fail the run if violated.

## Index audit

```bash
npm run audit:indexes
```

Walks every model and prints both the indexes declared in the schema and
what's actually in Mongo, so you can spot drift before it bites
production.

## Bundle analyzer

```bash
npm run analyze
```

Wraps the Next build with `@next/bundle-analyzer` (loaded lazily — normal
builds don't pay the cost). Opens an interactive treemap of the client +
server bundles.

## Security checklist (re-run before each release)

- [ ] `npm audit` — no high or critical findings unresolved
- [ ] All env values in `.env.example` exist with strong values in production
- [ ] `CRON_SECRET`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` rotated and length ≥ 32
- [ ] HSTS active (the `Strict-Transport-Security` header only applies in production builds — verify with curl after deploy)
- [ ] CORS allowlist doesn't include `*` in production
- [ ] Admin user count audited (`db.users.find({ role: 'admin' })`)
- [ ] Rate limit numbers tuned to traffic (defaults: 300/15m global, 20/15m auth)
