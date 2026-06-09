const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const groups = require('@/lib/services/split-group.service');
const v = require('@/lib/validators/split.validator');

// POST /api/v1/groups/invites/:token — the SMS-invited user, now signed
// up, redeems the token to join the group.
exports.POST = withRoute(
  async ({ user, params }) => {
    const result = await groups.redeemInvite(user.id, params.token);
    return ApiResponse.ok(result, 'Joined group');
  },
  { auth: true, schema: v.redeemInvite }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
