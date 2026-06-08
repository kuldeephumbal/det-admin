const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const debts = require('@/lib/services/debt.service');
const v = require('@/lib/validators/debt.validator');

exports.GET = withRoute(
  async ({ user, params }) => ApiResponse.ok(await debts.get(user.id, params.id)),
  { auth: true, schema: v.debtParam }
);

exports.PATCH = withRoute(
  async ({ user, params, body }) => {
    const debt = await debts.update(user.id, params.id, body);
    return ApiResponse.ok(debt, 'Debt updated');
  },
  { auth: true, requireVerified: true, schema: v.updateDebt }
);

exports.DELETE = withRoute(
  async ({ user, params }) => {
    await debts.softDelete(user.id, params.id);
    return ApiResponse.noContent();
  },
  { auth: true, schema: v.debtParam }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
