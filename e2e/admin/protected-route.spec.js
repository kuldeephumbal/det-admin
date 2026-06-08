// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Verifies `middleware.js` blocks unauthenticated access to the admin area.
 * Does NOT require a database — the redirect happens before any page renders.
 */
test.describe('Admin route protection', () => {
  test('redirects to /admin/login when no session cookie is present', async ({ context, page }) => {
    await context.clearCookies();

    const response = await page.goto('/admin');

    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin/);
    // Login page reachable: 200 OK after the redirect chain settles.
    expect(response?.ok()).toBeTruthy();
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });

  test('preserves the next= param when redirected from a deeper route', async ({ context, page }) => {
    await context.clearCookies();

    await page.goto('/admin/users');

    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fusers/);
  });
});
