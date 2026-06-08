const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const admin = require('@/lib/services/admin.service');

exports.GET = withRoute(
  async () => ApiResponse.ok(await admin.dashboard()),
  { auth: 'admin' }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
