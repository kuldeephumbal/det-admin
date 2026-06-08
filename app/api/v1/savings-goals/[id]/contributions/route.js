const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const savings = require('@/lib/services/savings.service');
const v = require('@/lib/validators/savings.validator');

exports.GET = withRoute(
  async ({ user, params, query }) => {
    const { items, page, limit, total } = await savings.listContributions(
      user.id,
      params.id,
      query
    );
    return ApiResponse.paginated(items, { page, limit, total });
  },
  { auth: true, schema: v.listContributions }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
