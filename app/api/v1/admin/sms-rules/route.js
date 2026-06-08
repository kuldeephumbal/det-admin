const { withRoute } = require('@/lib/api/withRoute');
const { withAudit } = require('@/lib/api/auditLog');
const ApiResponse = require('@/lib/utils/ApiResponse');
const sms = require('@/lib/services/smsRules.service');
const v = require('@/lib/validators/smsRules.validator');

exports.GET = withRoute(
  async ({ query }) => {
    const { items, page, limit, total } = await sms.listForAdmin(query);
    return ApiResponse.paginated(items, { page, limit, total });
  },
  { auth: 'admin', schema: v.listRules }
);

exports.POST = withRoute(
  withAudit(
    async ({ body }) => {
      const rule = await sms.create(body);
      return ApiResponse.created(rule, 'SMS rule created');
    },
    {
      action: 'sms_rule.create',
      target: (_ctx, result) => ({ type: 'sms_rule', id: result?.data?.id }),
      meta: ({ body }) => ({ name: body.name, bankName: body.bankName || '' }),
    }
  ),
  { auth: 'admin', schema: v.createRule }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
