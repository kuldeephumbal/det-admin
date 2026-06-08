const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const sharing = require('@/lib/services/sharing.service');
const v = require('@/lib/validators/sharing.validator');

// GET /api/v1/accounts/:id/members — list owner + active/pending members.
exports.GET = withRoute(
  async ({ user, params }) => {
    const data = await sharing.listMembers(user.id, params.id);
    return ApiResponse.ok(data);
  },
  { auth: true, schema: v.pendingMembershipParam }
);

// POST /api/v1/accounts/:id/members — invite by email. Owner-only,
// premium-gated. Body: { email, role? }.
exports.POST = withRoute(
  async ({ user, params, body }) => {
    const membership = await sharing.invite(user.id, params.id, body);
    return ApiResponse.created(membership, 'Invitation sent');
  },
  {
    auth: true,
    requireVerified: true,
    plan: 'premium',
    schema: v.inviteByEmail,
    rateLimit: { bucket: 'auth', windowMs: 15 * 60 * 1000, max: 20 },
  }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
