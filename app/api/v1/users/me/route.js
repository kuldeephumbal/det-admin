const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const userService = require('@/lib/services/user.service');
const v = require('@/lib/validators/user.validator');

exports.GET = withRoute(
  async ({ user }) => {
    const me = await userService.getMe(user.id);
    return ApiResponse.ok(me);
  },
  { auth: true }
);

exports.PATCH = withRoute(
  async ({ body, user }) => {
    const me = await userService.updateMe(user.id, body);
    return ApiResponse.ok(me, 'Profile updated');
  },
  { auth: true, schema: v.updateMe }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
