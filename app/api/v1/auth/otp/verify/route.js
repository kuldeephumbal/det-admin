const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const authService = require('@/lib/services/auth.service');
const v = require('@/lib/validators/auth.validator');

// POST /api/v1/auth/otp/verify — exchange an emailed 6-digit code for a
// DET access+refresh token pair. Matched by email + code.
//
// One-shot — the server clears the code on success so it can't be reused.
// Entering the code implicitly verifies the email address.
exports.POST = withRoute(
  async ({ body, ip, userAgent }) => {
    const result = await authService.verifyOtp(body, { ip, userAgent });
    return ApiResponse.ok(result, 'Signed in');
  },
  {
    schema: v.verifyOtp,
    rateLimit: { bucket: 'auth', windowMs: 15 * 60 * 1000, max: 10 },
  }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
