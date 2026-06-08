const Joi = require('joi');
const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const score = require('@/lib/services/ai/score.service');

const history = {
  query: Joi.object({
    limit: Joi.number().integer().min(1).max(36).default(12),
  }).unknown(true),
};

// GET /api/v1/financial-score/history?limit=12 — score over time.
exports.GET = withRoute(
  async ({ user, query }) => {
    const data = await score.getHistory(user.id, query);
    return ApiResponse.ok(data);
  },
  { auth: true, plan: 'premium', schema: history }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
