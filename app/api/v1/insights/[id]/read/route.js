const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const insights = require('@/lib/services/ai/insights.service');
const v = require('@/lib/validators/insight.validator');

// PATCH /api/v1/insights/:id/read — mark read. Idempotent.
exports.PATCH = withRoute(
  async ({ user, params }) => {
    const item = await insights.markRead(user.id, params.id);
    return ApiResponse.ok(item);
  },
  { auth: true, plan: 'premium', schema: v.insightParam }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
