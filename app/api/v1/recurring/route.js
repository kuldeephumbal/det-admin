const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const recurring = require('@/lib/services/recurring.service');
const v = require('@/lib/validators/recurring.validator');

exports.GET = withRoute(
  async ({ query, user }) => ApiResponse.ok(await recurring.list(user.id, query)),
  { auth: true, schema: v.list }
);

exports.POST = withRoute(
  async ({ body, user }) =>
    ApiResponse.created(await recurring.create(user.id, body), 'Recurring expense added'),
  { auth: true, schema: v.create }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
