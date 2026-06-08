const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const notifications = require('@/lib/services/notification.service');

exports.GET = withRoute(
  async ({ user }) => ApiResponse.ok(await notifications.unreadCount(user.id)),
  { auth: true }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
