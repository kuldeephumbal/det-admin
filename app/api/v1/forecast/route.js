const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const forecast = require('@/lib/services/ai/forecast.service');

// GET /api/v1/forecast — premium cash-flow forecast for the next 30
// days. Builds on bills + recurring + savings auto-contributions + the
// user's daily-average discretionary spend.
exports.GET = withRoute(
  async ({ user }) => ApiResponse.ok(await forecast.generate(user.id)),
  { auth: true, plan: 'premium' }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
