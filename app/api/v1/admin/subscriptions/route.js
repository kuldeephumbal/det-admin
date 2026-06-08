const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const admin = require('@/lib/services/admin.service');
const v = require('@/lib/validators/admin.validator');

exports.GET = withRoute(
  async ({ query }) => {
    const { items, page, limit, total } = await admin.listSubscriptions(query);
    return ApiResponse.paginated(items, { page, limit, total });
  },
  { auth: 'admin', schema: v.listSubscriptions }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
