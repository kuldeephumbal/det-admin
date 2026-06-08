const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const accounts = require('@/lib/services/account.service');
const v = require('@/lib/validators/account.validator');

// POST /api/v1/accounts/:id/transfer — internal transfer from this
// account to another of the user's accounts. Creates a paired
// debit/credit expense pair with shared `transferPair`.
exports.POST = withRoute(
  async ({ user, params, body }) => {
    const data = await accounts.transfer(user.id, params.id, body);
    return ApiResponse.created(data, 'Transfer recorded');
  },
  {
    auth: true,
    requireVerified: true,
    schema: v.transfer,
    rateLimit: { bucket: 'default', windowMs: 60 * 1000, max: 20 },
  }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
