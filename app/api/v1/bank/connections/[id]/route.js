const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const conn = require('@/lib/services/bank/connection.service');
const v = require('@/lib/validators/bank.validator');

// DELETE /api/v1/bank/connections/:id — disconnect a bank link. Best-
// effort provider disconnect; the local row flips to `disconnected`
// and the encrypted token blob is wiped regardless of provider outcome.
exports.DELETE = withRoute(
  async ({ user, params }) => {
    const data = await conn.disconnect(user.id, params.id);
    return ApiResponse.ok(data, 'Bank disconnected');
  },
  { auth: true, plan: 'premium', schema: v.connectionParam }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
