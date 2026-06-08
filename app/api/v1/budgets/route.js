const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const budgetService = require('@/lib/services/budget.service');
const v = require('@/lib/validators/budget.validator');

exports.GET = withRoute(
  async ({ query, user }) => ApiResponse.ok(await budgetService.list(user.id, query)),
  { auth: true, schema: v.list }
);

exports.POST = withRoute(
  async ({ body, user }) => ApiResponse.created(await budgetService.create(user.id, body), 'Budget created'),
  { auth: true, schema: v.create }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
