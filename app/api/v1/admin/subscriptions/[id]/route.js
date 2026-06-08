const { withRoute } = require('@/lib/api/withRoute');
const { withAudit } = require('@/lib/api/auditLog');
const ApiResponse = require('@/lib/utils/ApiResponse');
const subscriptions = require('@/lib/services/subscription.service');
const v = require('@/lib/validators/subscription.validator');

// PATCH /api/v1/admin/subscriptions/:id — comp premium / force-set
// status. Audited via withAudit so every adjustment is attributable.
exports.PATCH = withRoute(
  withAudit(
    async ({ params, body }) => {
      const updated = await subscriptions.adminUpdate(params.id, body);
      return ApiResponse.ok(updated, 'Subscription updated');
    },
    {
      action: 'subscription.update',
      target: ({ params }) => ({ type: 'subscription', id: params.id }),
      meta: ({ body }) => ({
        extendByDays: body.extendByDays || null,
        statusChange: body.status || null,
        planChange: body.plan || null,
        note: body.note || '',
      }),
    }
  ),
  { auth: 'admin', schema: v.adminUpdate }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
