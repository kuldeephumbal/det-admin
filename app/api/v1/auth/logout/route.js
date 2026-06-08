const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const authService = require('@/lib/services/auth.service');
const v = require('@/lib/validators/auth.validator');

exports.POST = withRoute(
  async ({ body }) => {
    await authService.logout(body.refreshToken);
    return ApiResponse.ok(null, 'Logged out');
  },
  { schema: v.logout }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
