const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const insights = require('@/lib/services/ai/insights.service');
const v = require('@/lib/validators/insight.validator');

// GET /api/v1/insights — paginated insight feed for the caller.
exports.GET = withRoute(
  async ({ user, query }) => {
    const { items, page, limit, total } = await insights.list(user.id, query);
    return ApiResponse.paginated(items, { page, limit, total });
  },
  { auth: true, plan: 'premium', schema: v.listInsights }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
