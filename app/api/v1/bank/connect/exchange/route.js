const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const conn = require('@/lib/services/bank/connection.service');
const v = require('@/lib/validators/bank.validator');

// POST /api/v1/bank/connect/exchange — completes the connect flow.
// The mobile client returns the provider's public token; we exchange
// it for an access token, seal it, and persist the BankConnection.
exports.POST = withRoute(
  async ({ user, body }) => {
    const data = await conn.exchangePublicToken(user.id, body);
    return ApiResponse.created(data, 'Bank connected');
  },
  {
    auth: true,
    requireVerified: true,
    plan: 'premium',
    schema: v.exchangeConnect,
    rateLimit: { bucket: 'auth', windowMs: 60 * 60 * 1000, max: 20 },
  }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
