const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const savings = require('@/lib/services/savings.service');
const v = require('@/lib/validators/savings.validator');

// POST /api/v1/savings-goals/:id/contribute — record a manual contribution.
// Signed amounts: positives add to the goal, negatives are withdrawals.
exports.POST = withRoute(
  async ({ user, params, body }) => {
    const result = await savings.contribute(user.id, params.id, body);
    return ApiResponse.created(result, 'Contribution recorded');
  },
  {
    auth: true,
    requireVerified: true,
    schema: v.contribute,
    rateLimit: { bucket: 'default', windowMs: 60 * 1000, max: 30 },
  }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
