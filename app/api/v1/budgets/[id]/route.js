const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const budgetService = require('@/lib/services/budget.service');
const v = require('@/lib/validators/budget.validator');

exports.PATCH = withRoute(
  async ({ params, body, user }) =>
    ApiResponse.ok(await budgetService.update(user.id, params.id, body), 'Budget updated'),
  { auth: true, schema: v.update }
);

exports.DELETE = withRoute(
  async ({ params, user }) => {
    await budgetService.softDelete(user.id, params.id);
    return ApiResponse.ok(null, 'Budget deleted');
  },
  { auth: true, schema: v.byId }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
