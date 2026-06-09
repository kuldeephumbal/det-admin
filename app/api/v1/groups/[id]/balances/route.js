const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const expenses = require('@/lib/services/split-expense.service');
const v = require('@/lib/validators/split.validator');

// GET /api/v1/groups/:id/balances — derived net balances, raw per-pair
// debts, and the greedy "simplified" payment set.
exports.GET = withRoute(
  async ({ user, params }) => ApiResponse.ok(await expenses.groupBalances(user.id, params.id)),
  { auth: true, schema: v.groupParam }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
