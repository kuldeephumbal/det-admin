const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');

exports.GET = withRoute(
  async () =>
    ApiResponse.ok(
      { version: 'v1', phase: 2 },
      'DET API v1'
    ),
  { skipDb: true, rateLimit: false }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
