const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const authService = require('@/lib/services/auth.service');
const v = require('@/lib/validators/auth.validator');

exports.POST = withRoute(
  async ({ body, ip, userAgent }) => {
    const tokens = await authService.rotateRefreshToken(body.refreshToken, { ip, userAgent });
    return ApiResponse.ok(tokens, 'Token refreshed');
  },
  { schema: v.refresh }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
