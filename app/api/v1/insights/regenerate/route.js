const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const insights = require('@/lib/services/ai/insights.service');
const v = require('@/lib/validators/insight.validator');

// POST /api/v1/insights/regenerate — user-triggered refresh. The
// service enforces a per-user daily cap (env.INSIGHT_REGENERATE_DAILY_CAP)
// to bound LLM cost.
exports.POST = withRoute(
  async ({ user }) => {
    const result = await insights.regenerate(user.id);
    return ApiResponse.ok(result, 'Insights regenerated');
  },
  {
    auth: true,
    plan: 'premium',
    schema: v.regenerate,
    rateLimit: { bucket: 'default', windowMs: 60 * 60 * 1000, max: 3 },
  }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
