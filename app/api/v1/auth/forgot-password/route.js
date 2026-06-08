const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const authService = require('@/lib/services/auth.service');
const v = require('@/lib/validators/auth.validator');

exports.POST = withRoute(
  async ({ body, origin }) => {
    await authService.forgotPassword(body, { resetBaseUrl: origin });
    return ApiResponse.ok(null, 'If that email exists, a reset link has been sent');
  },
  { schema: v.forgotPassword, rateLimit: { bucket: 'auth', windowMs: 15 * 60 * 1000, max: 20 } }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
