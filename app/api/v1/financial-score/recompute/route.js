const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const score = require('@/lib/services/ai/score.service');

// POST /api/v1/financial-score/recompute — user-initiated refresh.
// Rate-limited: heavy aggregation, abuse multiplier if hot.
exports.POST = withRoute(
  async ({ user }) => {
    const data = await score.recompute(user.id);
    return ApiResponse.ok(data, 'Score recomputed');
  },
  {
    auth: true,
    plan: 'premium',
    rateLimit: { bucket: 'default', windowMs: 60 * 60 * 1000, max: 3 },
  }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
