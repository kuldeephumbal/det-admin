// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Login page UI smokes — these do NOT require a database.
 * The `/api/v1/admin/session` POST is mocked per-test so the dev server's
 * Mongo connection is never exercised.
 */
test.describe('Admin login page', () => {
  test('renders the form', async ({ page }) => {
    await page.goto('/admin/login');

    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
    await expect(page.getByPlaceholder('••••••••')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('shows friendly error on 401 from the session endpoint', async ({ page }) => {
    await page.route('**/api/v1/admin/session', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' },
        }),
      })
    );

    await page.goto('/admin/login');
    await page.getByPlaceholder('you@example.com').fill('nope@example.com');
    await page.getByPlaceholder('••••••••').fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByText('Invalid email or password.')).toBeVisible();
    // Still on the login page — no redirect on failure.
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test('shows non-admin friendly error on 403', async ({ page }) => {
    await page.route('**/api/v1/admin/session', (route) =>
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: { code: 'FORBIDDEN', message: 'This account is not an admin' },
        }),
      })
    );

    await page.goto('/admin/login');
    await page.getByPlaceholder('you@example.com').fill('user@example.com');
    await page.getByPlaceholder('••••••••').fill('anypass123');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByText('This account is not an admin.')).toBeVisible();
  });

  test('shows success toast and attempts navigation on 200', async ({ page }) => {
    // Intercept BOTH the session POST (200 + cookie) and the subsequent
    // dashboard request — we don't have a DB so we just stub the dashboard
    // route as a redirect back to login. The point of the test is the
    // success toast + navigation attempt, not full SSR rendering.
    await page.route('**/api/v1/admin/session', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          // httpOnly cookie set by the real endpoint — mirror it here so the
          // browser carries it forward.
          'set-cookie':
            'det.admin=fake-session-token; Path=/; HttpOnly; SameSite=Lax',
        },
        body: JSON.stringify({
          success: true,
          message: 'Signed in',
          data: { user: { id: 'u1', name: 'Admin', email: 'admin@example.com', role: 'admin' } },
        }),
      })
    );
    // Stub the dashboard so we don't blow up trying to hit a real DB after
    // navigation — return a minimal HTML page.
    await page.route('**/admin', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<html><body><h1>Dashboard stub</h1></body></html>',
      })
    );

    await page.goto('/admin/login');
    await page.getByPlaceholder('you@example.com').fill('admin@example.com');
    await page.getByPlaceholder('••••••••').fill('Admin@123');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByText(/Signed in\. Taking you to the dashboard/i)).toBeVisible();
  });
});
