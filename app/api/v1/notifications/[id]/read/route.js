const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const notifications = require('@/lib/services/notification.service');
const v = require('@/lib/validators/notification.validator');

exports.PATCH = withRoute(
  async ({ params, user }) => {
    const item = await notifications.markRead(user.id, params.id);
    return ApiResponse.ok(item, 'Marked read');
  },
  { auth: true, schema: v.byId }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
