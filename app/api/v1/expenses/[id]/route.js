const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const expenseService = require('@/lib/services/expense.service');
const v = require('@/lib/validators/expense.validator');

exports.GET = withRoute(
  async ({ params, user }) => {
    const expense = await expenseService.getById(user.id, params.id);
    return ApiResponse.ok(expense);
  },
  { auth: true, schema: v.byId }
);

exports.PATCH = withRoute(
  async ({ params, body, user }) => {
    const expense = await expenseService.update(user.id, params.id, body);
    return ApiResponse.ok(expense, 'Expense updated');
  },
  { auth: true, schema: v.update }
);

exports.DELETE = withRoute(
  async ({ params, user }) => {
    await expenseService.softDelete(user.id, params.id);
    return ApiResponse.ok(null, 'Expense deleted');
  },
  { auth: true, schema: v.byId }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
