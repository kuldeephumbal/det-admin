const { withRoute } = require('@/lib/api/withRoute');
const { withAudit } = require('@/lib/api/auditLog');
const ApiResponse = require('@/lib/utils/ApiResponse');
const sms = require('@/lib/services/smsRules.service');
const v = require('@/lib/validators/smsRules.validator');

exports.PATCH = withRoute(
  withAudit(
    async ({ params, body }) => {
      const rule = await sms.update(params.id, body);
      return ApiResponse.ok(rule, 'SMS rule updated');
    },
    {
      action: 'sms_rule.update',
      target: ({ params }) => ({ type: 'sms_rule', id: params.id }),
      meta: ({ body }) => ({ changedFields: Object.keys(body) }),
    }
  ),
  { auth: 'admin', schema: v.updateRule }
);

exports.DELETE = withRoute(
  withAudit(
    async ({ params }) => {
      await sms.remove(params.id);
      return ApiResponse.noContent();
    },
    {
      action: 'sms_rule.delete',
      target: ({ params }) => ({ type: 'sms_rule', id: params.id }),
    }
  ),
  { auth: 'admin', schema: v.ruleParam }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
