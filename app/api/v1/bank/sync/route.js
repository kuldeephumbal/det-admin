const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const sync = require('@/lib/services/bank/sync.service');
const v = require('@/lib/validators/bank.validator');

// POST /api/v1/bank/sync — user-triggered sync. Rate-limited to keep
// provider API hits bounded; the hourly cron handles the routine case.
exports.POST = withRoute(
  async ({ user, body }) => {
    const result = body?.connectionId
      ? await sync.syncConnection(body.connectionId)
      : await sync.syncAllForUser(user.id);
    return ApiResponse.ok(result, 'Sync triggered');
  },
  {
    auth: true,
    plan: 'premium',
    schema: v.triggerSync,
    rateLimit: { bucket: 'default', windowMs: 60 * 60 * 1000, max: 6 },
  }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
