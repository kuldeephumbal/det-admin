const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const expenseService = require('@/lib/services/expense.service');
const v = require('@/lib/validators/expense.validator');

exports.POST = withRoute(
  async ({ body, user }) => {
    const expense = await expenseService.create(user.id, body);
    return ApiResponse.created(expense, 'Expense added');
  },
  { auth: true, schema: v.create }
);

exports.GET = withRoute(
  async ({ query, user }) => {
    const { items, page, limit, total } = await expenseService.list(user.id, query);
    return ApiResponse.paginated(items, { page, limit, total });
  },
  { auth: true, schema: v.list }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
