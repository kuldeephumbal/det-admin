const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const authService = require('@/lib/services/auth.service');
const v = require('@/lib/validators/auth.validator');

// POST /api/v1/auth/otp — email a one-time 6-digit sign-in code.
//
// Lazy account creation: if the email doesn't exist, a passwordless User
// row is created on the spot, then the code is dispatched to the same
// address. The response shape is identical for new and returning users so
// the endpoint can't be used to enumerate accounts.
exports.POST = withRoute(
  async ({ body }) => {
    const result = await authService.requestOtp(body);
    return ApiResponse.ok(result, 'Code sent — check your email');
  },
  {
    schema: v.requestOtp,
    rateLimit: { bucket: 'auth', windowMs: 15 * 60 * 1000, max: 10 },
  }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
