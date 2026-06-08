const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const notifications = require('@/lib/services/notification.service');
const v = require('@/lib/validators/notification.validator');

exports.GET = withRoute(
  async ({ query, user }) => {
    const { items, page, limit, total } = await notifications.list(user.id, query);
    return ApiResponse.paginated(items, { page, limit, total });
  },
  { auth: true, schema: v.list }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
