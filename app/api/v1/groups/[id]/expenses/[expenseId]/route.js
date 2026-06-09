const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const expenses = require('@/lib/services/split-expense.service');
const v = require('@/lib/validators/split.validator');

exports.GET = withRoute(
  async ({ user, params }) => ApiResponse.ok(await expenses.get(user.id, params.id, params.expenseId)),
  { auth: true, schema: v.expenseParam }
);

exports.PATCH = withRoute(
  async ({ user, params, body }) => {
    const expense = await expenses.update(user.id, params.id, params.expenseId, body);
    return ApiResponse.ok(expense, 'Expense updated');
  },
  { auth: true, schema: v.updateExpense }
);

exports.DELETE = withRoute(
  async ({ user, params }) => {
    await expenses.softDelete(user.id, params.id, params.expenseId);
    return ApiResponse.noContent();
  },
  { auth: true, schema: v.expenseParam }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
