# Admin E2E (Playwright)

End-to-end smokes for the Next.js admin panel.

## What's covered

- `admin/login.spec.js` — login page UI + error handling for 401 / 403 / 200 (API mocked, **no DB needed**).
- `admin/protected-route.spec.js` — middleware redirect when no session cookie (**no DB needed**).
- `admin/auth-flow.spec.js` — full real-DB login → dashboard. **Skipped by default**; set `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD` to enable.

## First-time setup

```bash
npm install
npx playwright install chromium
```

## Run locally

The suite runs `next start` on **port 3010** (separate from `npm run dev` on 3000 so they don't clash). The prod build is faster and leaner than `next dev` and closer to what users hit.

```bash
# Build the app once, then run the smokes:
npm run e2e:build

# Or, if .next is already up-to-date:
npm run e2e

# Visual debugger
npm run e2e:ui
```

## Run the real-DB auth smoke

1. Start MongoDB locally (`docker compose up mongo` or whatever you use).
2. Seed an admin user:

   ```bash
   node scripts/create-admin.js admin@example.com 'Admin@1234'
   ```

3. Run the suite with credentials in env:

   ```bash
   E2E_ADMIN_EMAIL=admin@example.com E2E_ADMIN_PASSWORD='Admin@1234' npm run e2e
   ```

## Targeting a different host

Set `E2E_BASE_URL` (defaults to `http://localhost:3000`):

```bash
E2E_BASE_URL=https://staging.det.app npm run e2e
```
