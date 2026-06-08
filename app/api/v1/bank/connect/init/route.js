const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const conn = require('@/lib/services/bank/connection.service');
const v = require('@/lib/validators/bank.validator');

// POST /api/v1/bank/connect/init — kicks off the provider connect flow.
// Returns a linkToken / redirectUrl the mobile client opens.
exports.POST = withRoute(
  async ({ user, body }) => {
    const data = await conn.initConnection(user.id, body);
    return ApiResponse.ok(data);
  },
  {
    auth: true,
    requireVerified: true,
    plan: 'premium',
    schema: v.initConnect,
    rateLimit: { bucket: 'auth', windowMs: 60 * 60 * 1000, max: 10 },
  }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
