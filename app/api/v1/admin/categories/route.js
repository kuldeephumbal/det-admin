const { withRoute } = require('@/lib/api/withRoute');
const { withAudit } = require('@/lib/api/auditLog');
const ApiResponse = require('@/lib/utils/ApiResponse');
const admin = require('@/lib/services/admin.service');
const v = require('@/lib/validators/admin.validator');

exports.GET = withRoute(
  async () => ApiResponse.ok(await admin.listDefaultCategories()),
  { auth: 'admin' }
);

exports.POST = withRoute(
  withAudit(
    async ({ body }) =>
      ApiResponse.created(await admin.createDefaultCategory(body), 'Default category created'),
    {
      action: 'category.create',
      target: (_ctx, result) => ({ type: 'category', id: result?.data?.id }),
      after: ({ body }) => body,
    },
  ),
  { auth: 'admin', schema: v.createDefaultCategory },
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
