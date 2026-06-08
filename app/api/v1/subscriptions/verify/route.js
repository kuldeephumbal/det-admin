const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const subscriptions = require('@/lib/services/subscription.service');
const v = require('@/lib/validators/subscription.validator');

// POST /api/v1/subscriptions/verify — client posts the provider's
// receipt blob; the server verifies with the provider and upserts
// the local Subscription + flips User.plan to premium on success.
//
// Rate-limited under the 'auth' bucket because a brute-force receipt
// guesser would be expensive (each call hits the provider).
exports.POST = withRoute(
  async ({ user, body }) => {
    const sub = await subscriptions.verifyAndUpsert(user.id, body);
    return ApiResponse.created(sub, 'Subscription verified');
  },
  {
    auth: true,
    requireVerified: true,
    schema: v.verifyPurchase,
    rateLimit: { bucket: 'auth', windowMs: 15 * 60 * 1000, max: 30 },
  }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
