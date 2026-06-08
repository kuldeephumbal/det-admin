const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const categoryService = require('@/lib/services/category.service');
const v = require('@/lib/validators/category.validator');

exports.GET = withRoute(
  async ({ query, user }) => {
    const items = await categoryService.listForUser(user.id, query);
    return ApiResponse.ok(items);
  },
  { auth: true, schema: v.list }
);

exports.POST = withRoute(
  async ({ body, user }) => {
    const cat = await categoryService.create(user.id, body);
    return ApiResponse.created(cat, 'Category created');
  },
  { auth: true, schema: v.create }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
