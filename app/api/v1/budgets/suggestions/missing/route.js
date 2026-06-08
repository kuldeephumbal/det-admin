const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const budget = require('@/lib/services/budget.service');

// GET /api/v1/budgets/suggestions/missing
//
// Categories the user spends in consistently but has no active budget
// for. Drives the home banner "You spend ₹X on Food but have no budget".
exports.GET = withRoute(
  async ({ user }) => {
    const data = await budget.missingBudgets(user.id);
    return ApiResponse.ok(data);
  },
  { auth: true, plan: 'premium' }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
