const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const budget = require('@/lib/services/budget.service');
const v = require('@/lib/validators/budget.validator');

// GET /api/v1/budgets/suggestions?category=<id>&period=monthly
//
// Returns a recommended budget amount for the given category, derived
// from a 3-month median + 10% buffer. Premium-only — surfaced in the
// "Create budget" sheet on the mobile client.
exports.GET = withRoute(
  async ({ user, query }) => {
    const data = await budget.suggestForCategory(user.id, query);
    return ApiResponse.ok(data);
  },
  { auth: true, plan: 'premium', schema: v.suggestion }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
