const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const conn = require('@/lib/services/bank/connection.service');

// GET /api/v1/bank/connections — list the caller's bank connections.
exports.GET = withRoute(
  async ({ user }) => {
    const data = await conn.list(user.id);
    return ApiResponse.ok(data);
  },
  { auth: true, plan: 'premium' }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
