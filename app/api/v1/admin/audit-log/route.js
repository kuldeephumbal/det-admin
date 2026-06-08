const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const audit = require('@/lib/services/audit.service');

// GET /api/v1/admin/audit-log
// Paginated. Optional filters: ?action=...&targetType=...&targetId=...&actor=...
exports.GET = withRoute(
  async ({ query }) => {
    const { items, page, limit, total } = await audit.list(query);
    return ApiResponse.paginated(items, { page, limit, total });
  },
  { auth: 'admin' },
);

exports.OPTIONS = withRoute(
  async () => new Response(null, { status: 204 }),
  { skipDb: true },
);
