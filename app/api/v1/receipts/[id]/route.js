const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const receipts = require('@/lib/services/receipt.service');
const v = require('@/lib/validators/receipt.validator');

exports.GET = withRoute(
  async ({ user, params }) => {
    const data = await receipts.get(user.id, params.id);
    return ApiResponse.ok(data);
  },
  { auth: true, plan: 'premium', schema: v.receiptParam }
);

exports.DELETE = withRoute(
  async ({ user, params }) => {
    await receipts.softDelete(user.id, params.id);
    return ApiResponse.noContent();
  },
  { auth: true, plan: 'premium', schema: v.receiptParam }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
