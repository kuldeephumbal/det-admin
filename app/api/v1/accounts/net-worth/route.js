const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const accounts = require('@/lib/services/account.service');

// GET /api/v1/accounts/net-worth — sum across active, non-excluded
// accounts, grouped by currency.
//
// Multi-currency conversion to the user's display currency is a Phase 5
// follow-up — for now the response is structured as `{ byCurrency: { INR: x, USD: y }, accounts: N }`
// so the mobile UI can render each row and surface the breakdown
// honestly until FX rates land.
exports.GET = withRoute(
  async ({ user }) => {
    const data = await accounts.netWorth(user.id);
    return ApiResponse.ok(data);
  },
  { auth: true }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
