const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const sharing = require('@/lib/services/sharing.service');
const v = require('@/lib/validators/sharing.validator');

// DELETE /api/v1/accounts/:id/members/:membershipId — either the owner
// kicks a member or the member self-removes. Same endpoint for both;
// the service decides who's allowed.
exports.DELETE = withRoute(
  async ({ user, params }) => {
    const result = await sharing.revoke(user.id, params.id, params.membershipId);
    return ApiResponse.ok(result, 'Membership revoked');
  },
  { auth: true, schema: v.membershipParam }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
