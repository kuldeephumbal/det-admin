const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const accounts = require('@/lib/services/account.service');
const v = require('@/lib/validators/account.validator');

// GET /api/v1/accounts — list the caller's active accounts.
exports.GET = withRoute(
  async ({ user, query }) => {
    const data = await accounts.list(user.id, {
      includeArchived: query.includeArchived === 'true' || query.includeArchived === true,
    });
    return ApiResponse.ok(data);
  },
  { auth: true, schema: v.listAccounts }
);

// POST /api/v1/accounts — create a new account.
exports.POST = withRoute(
  async ({ user, body }) => {
    const data = await accounts.create(user.id, body);
    return ApiResponse.created(data, 'Account created');
  },
  { auth: true, schema: v.createAccount }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
