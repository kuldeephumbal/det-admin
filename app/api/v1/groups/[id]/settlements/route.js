const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const groups = require('@/lib/services/split-group.service');
const v = require('@/lib/validators/split.validator');

exports.GET = withRoute(
  async ({ user, params }) => ApiResponse.ok(await groups.listSettlements(user.id, params.id)),
  { auth: true, schema: v.groupParam }
);

// POST /api/v1/groups/:id/settlements — record a payback (no real money).
exports.POST = withRoute(
  async ({ user, params, body }) => {
    const settlement = await groups.createSettlement(user.id, params.id, body);
    return ApiResponse.created(settlement, 'Payment recorded');
  },
  { auth: true, schema: v.createSettlement }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
