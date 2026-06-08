const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const savings = require('@/lib/services/savings.service');
const v = require('@/lib/validators/savings.validator');

exports.GET = withRoute(
  async ({ user, params }) => {
    const goal = await savings.get(user.id, params.id);
    return ApiResponse.ok(goal);
  },
  { auth: true, schema: v.goalParam }
);

exports.PATCH = withRoute(
  async ({ user, params, body }) => {
    const goal = await savings.update(user.id, params.id, body);
    return ApiResponse.ok(goal, 'Goal updated');
  },
  { auth: true, requireVerified: true, schema: v.updateGoal }
);

exports.DELETE = withRoute(
  async ({ user, params }) => {
    await savings.softDelete(user.id, params.id);
    return ApiResponse.noContent();
  },
  { auth: true, schema: v.goalParam }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
