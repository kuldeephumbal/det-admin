const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const score = require('@/lib/services/ai/score.service');

// GET /api/v1/financial-score — current month's snapshot (computed
// on demand if not yet cached). Returns null when the user hasn't
// logged enough activity yet — mobile shows an empty state.
exports.GET = withRoute(
  async ({ user }) => {
    const data = await score.getCurrent(user.id);
    return ApiResponse.ok(data);
  },
  { auth: true, plan: 'premium' }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
