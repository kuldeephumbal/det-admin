// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright configuration for the DET admin E2E suite.
 *
 * Default specs are DB-free — they mock the `/api/v1/admin/session` response
 * and test the login UI + middleware redirect. The full login → dashboard
 * spec is gated on `E2E_ADMIN_EMAIL` + `E2E_ADMIN_PASSWORD` and skips when
 * unset, so it's safe to run in any environment.
 *
 * Run:  npm run e2e
 * UI:   npm run e2e:ui
 */

// Use a non-default port so the e2e dev server doesn't clash with a regular
// `npm run dev` that's likely already on 3000.
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3010';

module.exports = defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  // Run against the production build on port 3010. This is faster, leaner,
  // and closer to what users actually hit than `next dev`. Requires that
  // `npm run build` has been run first — `npm run e2e` aliases bake that
  // in. CI runs `npm run build` in the e2e job before the suite.
  webServer: {
    command: 'npx next start -p 3010',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
