const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const accounts = require('@/lib/services/account.service');
const v = require('@/lib/validators/account.validator');

exports.GET = withRoute(
  async ({ user, params }) => {
    const data = await accounts.get(user.id, params.id);
    return ApiResponse.ok(data);
  },
  { auth: true, schema: v.accountParam }
);

exports.PATCH = withRoute(
  async ({ user, params, body }) => {
    const data = await accounts.update(user.id, params.id, body);
    return ApiResponse.ok(data, 'Account updated');
  },
  { auth: true, schema: v.updateAccount }
);

exports.DELETE = withRoute(
  async ({ user, params }) => {
    await accounts.softDelete(user.id, params.id);
    return ApiResponse.noContent();
  },
  { auth: true, schema: v.accountParam }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
