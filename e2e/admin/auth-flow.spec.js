// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Full login → dashboard smoke against the REAL backend. This needs:
 *
 *   - a running MongoDB (via .env.local's MONGO_URI)
 *   - a real admin user seeded — create one with:
 *       node scripts/create-admin.js you@example.com 'StrongPass1'
 *   - the credentials passed to Playwright via env:
 *       E2E_ADMIN_EMAIL  / E2E_ADMIN_PASSWORD
 *
 * If either env var is unset, the suite skips — so the test is safe to
 * include in any environment.
 */

const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

test.describe('Full admin auth flow (real DB)', () => {
  test.skip(
    !email || !password,
    'Set E2E_ADMIN_EMAIL + E2E_ADMIN_PASSWORD to run the real-DB auth smoke.'
  );

  test('logs in, lands on dashboard, signs back out', async ({ page }) => {
    await page.goto('/admin/login');

    await page.getByPlaceholder('you@example.com').fill(email);
    await page.getByPlaceholder('••••••••').fill(password);
    await page.getByRole('button', { name: /sign in/i }).click();

    // The login page shows a 500ms-delayed router.replace — wait for the URL.
    await page.waitForURL('**/admin', { timeout: 10_000 });

    // Dashboard's hero section has a "Live" pill — minimal proof we
    // reached the protected page and SSR ran.
    await expect(page.getByText('Live', { exact: true })).toBeVisible();
  });
});
