const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const categoryService = require('@/lib/services/category.service');
const v = require('@/lib/validators/category.validator');

exports.PATCH = withRoute(
  async ({ params, body, user }) => {
    const cat = await categoryService.update(user.id, params.id, body);
    return ApiResponse.ok(cat, 'Category updated');
  },
  { auth: true, schema: v.update }
);

exports.DELETE = withRoute(
  async ({ params, query, user }) => {
    const result = await categoryService.softDelete(user.id, params.id, { force: !!query.force });
    return ApiResponse.ok(result, 'Category deleted');
  },
  { auth: true, schema: v.remove }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
