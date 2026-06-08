const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const savings = require('@/lib/services/savings.service');
const v = require('@/lib/validators/savings.validator');

// GET /api/v1/savings-goals/:id/status — on-track projection.
exports.GET = withRoute(
  async ({ user, params }) => {
    const status = await savings.status(user.id, params.id);
    return ApiResponse.ok(status);
  },
  { auth: true, schema: v.goalParam }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
