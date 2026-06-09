const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const groups = require('@/lib/services/split-group.service');
const v = require('@/lib/validators/split.validator');

// GET /api/v1/groups — groups I own or am an active member of.
exports.GET = withRoute(
  async ({ user, query }) => {
    const { items, page, limit, total } = await groups.listGroups(user.id, query);
    return ApiResponse.paginated(items, { page, limit, total });
  },
  { auth: true, schema: v.listGroups }
);

// POST /api/v1/groups — create a group (caller becomes owner + member).
exports.POST = withRoute(
  async ({ user, body }) => {
    const group = await groups.createGroup(user.id, body);
    return ApiResponse.created(group, 'Group created');
  },
  { auth: true, schema: v.createGroup }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
