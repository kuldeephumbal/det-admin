const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const authService = require('@/lib/services/auth.service');
const v = require('@/lib/validators/auth.validator');

// POST /api/v1/auth/google — exchange a Google ID token for DET tokens.
//
// Returns the same shape as /auth/login + /auth/register so the mobile
// auth controller can treat the response uniformly.
exports.POST = withRoute(
  async ({ body, ip, userAgent }) => {
    const result = await authService.googleSignIn(body, { ip, userAgent });
    return ApiResponse.ok(result, 'Signed in with Google');
  },
  {
    schema: v.googleSignIn,
    rateLimit: { bucket: 'auth', windowMs: 15 * 60 * 1000, max: 20 },
  }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
