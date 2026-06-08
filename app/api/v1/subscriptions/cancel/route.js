const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const subscriptions = require('@/lib/services/subscription.service');
const v = require('@/lib/validators/subscription.validator');

// POST /api/v1/subscriptions/cancel — user-initiated cancel. The
// subscription stays active until currentPeriodEnd; the daily cron
// downgrades it then.
exports.POST = withRoute(
  async ({ user, body }) => {
    const sub = await subscriptions.cancel(user.id, body || {});
    return ApiResponse.ok(sub, 'Subscription cancelled');
  },
  {
    auth: true,
    schema: v.cancel,
    rateLimit: { bucket: 'auth', windowMs: 15 * 60 * 1000, max: 10 },
  }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
