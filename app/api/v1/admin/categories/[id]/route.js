const { withRoute } = require('@/lib/api/withRoute');
const { withAudit } = require('@/lib/api/auditLog');
const ApiResponse = require('@/lib/utils/ApiResponse');
const admin = require('@/lib/services/admin.service');
const v = require('@/lib/validators/admin.validator');

exports.PATCH = withRoute(
  withAudit(
    async ({ params, body }) =>
      ApiResponse.ok(await admin.updateDefaultCategory(params.id, body), 'Updated'),
    {
      action: 'category.update',
      target: ({ params }) => ({ type: 'category', id: params.id }),
      after: ({ body }) => body,
    },
  ),
  { auth: 'admin', schema: v.updateDefaultCategory },
);

exports.DELETE = withRoute(
  withAudit(
    async ({ params }) => {
      await admin.deleteDefaultCategory(params.id);
      return ApiResponse.ok(null, 'Deleted');
    },
    {
      action: 'category.delete',
      target: ({ params }) => ({ type: 'category', id: params.id }),
    },
  ),
  { auth: 'admin' },
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
