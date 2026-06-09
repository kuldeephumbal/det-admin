const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const groups = require('@/lib/services/split-group.service');
const v = require('@/lib/validators/split.validator');

exports.GET = withRoute(
  async ({ user, params }) => ApiResponse.ok(await groups.getGroup(user.id, params.id)),
  { auth: true, schema: v.groupParam }
);

exports.PATCH = withRoute(
  async ({ user, params, body }) => {
    const group = await groups.updateGroup(user.id, params.id, body);
    return ApiResponse.ok(group, 'Group updated');
  },
  { auth: true, schema: v.updateGroup }
);

exports.DELETE = withRoute(
  async ({ user, params }) => {
    await groups.deleteGroup(user.id, params.id);
    return ApiResponse.noContent();
  },
  { auth: true, schema: v.groupParam }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
