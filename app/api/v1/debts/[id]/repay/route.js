const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const debts = require('@/lib/services/debt.service');
const v = require('@/lib/validators/debt.validator');

// POST /api/v1/debts/:id/repay — record a partial or full repayment.
// Mints an Expense (debit for borrowed-debt, credit for lent-debt)
// and shrinks the cached `outstanding` accordingly. Flips status to
// 'settled' the moment outstanding hits zero.
exports.POST = withRoute(
  async ({ user, params, body }) => {
    const result = await debts.recordRepayment(user.id, params.id, body);
    return ApiResponse.created(result, 'Repayment recorded');
  },
  {
    auth: true,
    requireVerified: true,
    schema: v.recordRepayment,
    rateLimit: { bucket: 'default', windowMs: 60 * 1000, max: 30 },
  }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
