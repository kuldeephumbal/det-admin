const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const authService = require('@/lib/services/auth.service');
const v = require('@/lib/validators/auth.validator');

// POST /api/v1/auth/email-link/verify — exchange a magic-link token for
// a DET access+refresh token pair. Mobile posts this after handling the
// deep-link the user tapped from their inbox.
//
// One-shot — the server clears the token on success so a leaked link
// can't be reused. Email is implicitly verified by tapping from inside
// the user's inbox.
exports.POST = withRoute(
  async ({ body, ip, userAgent }) => {
    const result = await authService.verifyMagicLink(body, { ip, userAgent });
    return ApiResponse.ok(result, 'Signed in');
  },
  {
    schema: v.verifyMagicLink,
    rateLimit: { bucket: 'auth', windowMs: 15 * 60 * 1000, max: 20 },
  }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
