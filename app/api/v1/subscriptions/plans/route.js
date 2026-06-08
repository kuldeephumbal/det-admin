const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const subscriptions = require('@/lib/services/subscription.service');

// GET /api/v1/subscriptions/plans — public plan catalog. Unauth so the
// marketing site can fetch it, and so the mobile paywall doesn't need
// a logged-in user to render prices.
exports.GET = withRoute(
  async () => {
    const data = await subscriptions.listPlans();
    return ApiResponse.ok(data);
  },
  { skipDb: true }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
