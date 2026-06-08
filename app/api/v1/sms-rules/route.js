const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const sms = require('@/lib/services/smsRules.service');

// GET /api/v1/sms-rules — mobile fetches the active rules catalog.
// Premium-only since the SMS detection feature is a premium upsell.
exports.GET = withRoute(
  async () => ApiResponse.ok(await sms.listForMobile()),
  { auth: true, plan: 'premium' }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
