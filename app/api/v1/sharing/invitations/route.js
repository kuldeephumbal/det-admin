const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const sharing = require('@/lib/services/sharing.service');

// GET /api/v1/sharing/invitations — pending invitations addressed to
// the caller. Surfaced on the mobile "Shared with me" screen so the
// user can accept or decline.
exports.GET = withRoute(
  async ({ user }) => {
    const data = await sharing.listMyPendingInvitations(user.id);
    return ApiResponse.ok(data);
  },
  { auth: true }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
