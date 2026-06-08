const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const bills = require('@/lib/services/bill.service');
const v = require('@/lib/validators/bill.validator');

exports.GET = withRoute(
  async ({ user, params }) => ApiResponse.ok(await bills.get(user.id, params.id)),
  { auth: true, schema: v.billParam }
);

exports.PATCH = withRoute(
  async ({ user, params, body }) => {
    const bill = await bills.update(user.id, params.id, body);
    return ApiResponse.ok(bill, 'Bill updated');
  },
  { auth: true, requireVerified: true, schema: v.updateBill }
);

exports.DELETE = withRoute(
  async ({ user, params }) => {
    await bills.softDelete(user.id, params.id);
    return ApiResponse.noContent();
  },
  { auth: true, schema: v.billParam }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
