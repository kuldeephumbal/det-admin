const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const subscriptions = require('@/lib/services/subscription.service');

// GET /api/v1/subscriptions/me — current user's subscription snapshot.
// Lazily creates a free row on first access so mobile always has data
// to render even before a purchase happens.
exports.GET = withRoute(
  async ({ user }) => {
    const data = await subscriptions.getForUser(user.id);
    return ApiResponse.ok(data);
  },
  { auth: true }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
