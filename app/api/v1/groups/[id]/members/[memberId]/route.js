const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const groups = require('@/lib/services/split-group.service');
const v = require('@/lib/validators/split.validator');

// DELETE /api/v1/groups/:id/members/:memberId — owner removes a member.
exports.DELETE = withRoute(
  async ({ user, params }) => {
    await groups.revokeMember(user.id, params.id, params.memberId);
    return ApiResponse.noContent();
  },
  { auth: true, schema: v.memberParam }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
