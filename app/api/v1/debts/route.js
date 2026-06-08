const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const debts = require('@/lib/services/debt.service');
const v = require('@/lib/validators/debt.validator');

exports.GET = withRoute(
  async ({ user, query }) => {
    const { items, page, limit, total } = await debts.list(user.id, query);
    return ApiResponse.paginated(items, { page, limit, total });
  },
  { auth: true, schema: v.listDebts }
);

exports.POST = withRoute(
  async ({ user, body }) => {
    const debt = await debts.create(user.id, body);
    return ApiResponse.created(debt, 'Debt recorded');
  },
  { auth: true, requireVerified: true, schema: v.createDebt }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
