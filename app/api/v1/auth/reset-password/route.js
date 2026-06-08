const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const authService = require('@/lib/services/auth.service');
const v = require('@/lib/validators/auth.validator');

exports.POST = withRoute(
  async ({ body }) => {
    await authService.resetPassword(body);
    return ApiResponse.ok(null, 'Password reset successfully');
  },
  { schema: v.resetPassword, rateLimit: { bucket: 'auth', windowMs: 15 * 60 * 1000, max: 20 } }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
