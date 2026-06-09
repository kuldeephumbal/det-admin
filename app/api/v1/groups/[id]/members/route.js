const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const groups = require('@/lib/services/split-group.service');
const v = require('@/lib/validators/split.validator');

// GET /api/v1/groups/:id/members — active + pending members.
exports.GET = withRoute(
  async ({ user, params }) => ApiResponse.ok(await groups.listMembers(user.id, params.id)),
  { auth: true, schema: v.groupParam }
);

// POST /api/v1/groups/:id/members — add by email (existing/lazy user) or
// by phone (matches a DET user, else sends an SMS invite). Rate-limited
// because the phone path can dispatch SMS.
exports.POST = withRoute(
  async ({ user, params, body }) => {
    const member = await groups.invite(user.id, params.id, body);
    return ApiResponse.created(member, 'Member added');
  },
  {
    auth: true,
    schema: v.inviteMember,
    rateLimit: { bucket: 'auth', windowMs: 15 * 60 * 1000, max: 30 },
  }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
