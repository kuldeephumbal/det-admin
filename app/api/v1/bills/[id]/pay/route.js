const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const bills = require('@/lib/services/bill.service');
const v = require('@/lib/validators/bill.validator');

// POST /api/v1/bills/:id/pay — mark a bill paid. Mints an Expense for
// the actual paid amount, stamps the bill, and (if recurring) creates
// the next instance in the chain.
exports.POST = withRoute(
  async ({ user, params, body }) => {
    const result = await bills.pay(user.id, params.id, body || {});
    return ApiResponse.created(result, 'Bill marked paid');
  },
  {
    auth: true,
    requireVerified: true,
    schema: v.payBill,
    rateLimit: { bucket: 'default', windowMs: 60 * 1000, max: 30 },
  }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
