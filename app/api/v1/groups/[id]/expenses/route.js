const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const expenses = require('@/lib/services/split-expense.service');
const v = require('@/lib/validators/split.validator');

exports.GET = withRoute(
  async ({ user, params, query }) => {
    const { items, page, limit, total } = await expenses.list(user.id, params.id, query);
    return ApiResponse.paginated(items, { page, limit, total });
  },
  { auth: true, schema: v.listExpenses }
);

exports.POST = withRoute(
  async ({ user, params, body }) => {
    const expense = await expenses.create(user.id, params.id, body);
    return ApiResponse.created(expense, 'Expense added');
  },
  { auth: true, schema: v.createExpense }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
