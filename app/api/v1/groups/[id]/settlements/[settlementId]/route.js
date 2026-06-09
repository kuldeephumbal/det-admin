const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const groups = require('@/lib/services/split-group.service');
const v = require('@/lib/validators/split.validator');

// DELETE /api/v1/groups/:id/settlements/:settlementId — undo a recorded
// payment; balances recalculate as if it never happened.
exports.DELETE = withRoute(
  async ({ user, params }) => {
    await groups.deleteSettlement(user.id, params.id, params.settlementId);
    return ApiResponse.noContent();
  },
  { auth: true, schema: v.settlementParam }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
