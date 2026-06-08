const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const analytics = require('@/lib/services/analytics.service');
const v = require('@/lib/validators/analytics.validator');

exports.GET = withRoute(
  async ({ query, user }) => ApiResponse.ok(await analytics.daily(user.id, query)),
  { auth: true, schema: v.daily }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
