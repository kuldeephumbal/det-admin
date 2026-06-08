const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const savings = require('@/lib/services/savings.service');
const v = require('@/lib/validators/savings.validator');

// GET /api/v1/savings-goals — list the caller's goals.
exports.GET = withRoute(
  async ({ user, query }) => {
    const items = await savings.list(user.id, { status: query.status });
    return ApiResponse.ok({ items });
  },
  { auth: true }
);

// POST /api/v1/savings-goals — create. Free tier capped at 1 active goal.
exports.POST = withRoute(
  async ({ user, body }) => {
    const goal = await savings.create(user.id, body);
    return ApiResponse.created(goal, 'Goal created');
  },
  { auth: true, requireVerified: true, schema: v.createGoal }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
