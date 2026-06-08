const { withRoute } = require('@/lib/api/withRoute');
const { withAudit } = require('@/lib/api/auditLog');
const ApiResponse = require('@/lib/utils/ApiResponse');
const admin = require('@/lib/services/admin.service');
const v = require('@/lib/validators/admin.validator');

exports.GET = withRoute(
  async ({ params }) => ApiResponse.ok(await admin.getUser(params.id)),
  { auth: 'admin', schema: v.userById }
);

exports.PATCH = withRoute(
  withAudit(
    async ({ params, body, user }) => {
      const r = await admin.updateUserStatus(params.id, body.status, user.id);
      return ApiResponse.ok(r, 'User updated');
    },
    {
      action: 'user.updateStatus',
      before: async ({ params }) => {
        const u = await admin.getUser(params.id);
        return { status: u?.status };
      },
      target: ({ params }) => ({ type: 'user', id: params.id }),
      after: ({ body }) => ({ status: body.status }),
    },
  ),
  { auth: 'admin', schema: v.updateUserStatus },
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
