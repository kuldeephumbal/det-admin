const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const authService = require('@/lib/services/auth.service');
const v = require('@/lib/validators/auth.validator');

exports.POST = withRoute(
  async ({ user, origin }) => {
    const result = await authService.sendVerification(user.id, { verifyBaseUrl: origin });
    return ApiResponse.ok(result, result.alreadyVerified ? 'Email already verified' : 'Verification email sent');
  },
  {
    auth: true,
    schema: v.sendVerification,
    rateLimit: { bucket: 'auth', windowMs: 15 * 60 * 1000, max: 20 },
  }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
