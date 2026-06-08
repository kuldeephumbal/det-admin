const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const bills = require('@/lib/services/bill.service');
const v = require('@/lib/validators/bill.validator');

// GET /api/v1/bills?state=upcoming|overdue|paid|all
exports.GET = withRoute(
  async ({ user, query }) => {
    const { items, page, limit, total } = await bills.list(user.id, query);
    return ApiResponse.paginated(items, { page, limit, total });
  },
  { auth: true, schema: v.listBills }
);

// POST /api/v1/bills — schedule a new bill.
exports.POST = withRoute(
  async ({ user, body }) => {
    const bill = await bills.create(user.id, body);
    return ApiResponse.created(bill, 'Bill scheduled');
  },
  { auth: true, requireVerified: true, schema: v.createBill }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
