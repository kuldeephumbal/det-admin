const { withRoute } = require('@/lib/api/withRoute');
const { withAudit } = require('@/lib/api/auditLog');
const ApiResponse = require('@/lib/utils/ApiResponse');
const admin = require('@/lib/services/admin.service');
const v = require('@/lib/validators/admin.validator');

exports.POST = withRoute(
  withAudit(
    async ({ body }) => ApiResponse.created(await admin.broadcast(body), 'Broadcast sent'),
    {
      action: 'notification.broadcast',
      target: () => ({ type: 'notification', id: null }),
      // Snapshot only the metadata we want to surface in the audit list —
      // skip the long body so logs stay scannable.
      meta: ({ body }) => ({
        title: body.title,
        bodyLength: (body.body || '').length,
        type: body.type,
        audience: body.audience,
      }),
    },
  ),
  { auth: 'admin', schema: v.broadcast },
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
