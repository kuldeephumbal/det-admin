const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const recurring = require('@/lib/services/recurring.service');
const v = require('@/lib/validators/recurring.validator');

exports.PATCH = withRoute(
  async ({ params, body, user }) =>
    ApiResponse.ok(await recurring.update(user.id, params.id, body), 'Updated'),
  { auth: true, schema: v.update }
);

exports.DELETE = withRoute(
  async ({ params, user }) => {
    await recurring.softDelete(user.id, params.id);
    return ApiResponse.ok(null, 'Deleted');
  },
  { auth: true, schema: v.byId }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
