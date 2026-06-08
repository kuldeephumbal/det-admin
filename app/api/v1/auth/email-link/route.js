const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const authService = require('@/lib/services/auth.service');
const v = require('@/lib/validators/auth.validator');

// POST /api/v1/auth/email-link — request a magic sign-in link.
//
// Lazy account creation: if the email doesn't exist, a passwordless
// User row is created on the spot, then the magic link is dispatched
// to the same address. From the client's perspective the response shape
// is identical for new and returning users so the endpoint can't be
// used to enumerate accounts.
exports.POST = withRoute(
  async ({ body, ip, userAgent }) => {
    const result = await authService.requestMagicLink(body, { ip, userAgent });
    return ApiResponse.ok(result, 'Sign-in link sent — check your email');
  },
  {
    schema: v.requestMagicLink,
    rateLimit: { bucket: 'auth', windowMs: 15 * 60 * 1000, max: 10 },
  }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
