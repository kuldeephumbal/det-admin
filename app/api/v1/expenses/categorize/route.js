const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const categorize = require('@/lib/services/ai/categorize.service');
const v = require('@/lib/validators/expense.validator');

// POST /api/v1/expenses/categorize — suggest a category for a note.
//
// Returns `{ suggestion: { categoryId, name, icon, color, confidence } }`
// when the per-user Naive Bayes model is confident enough; otherwise
// `{ suggestion: null, reason: 'low_confidence', sampleSize }`. The
// mobile add-expense sheet calls this debounced as the user types.
//
// Heavily rate-limited (default bucket, 60/min) to stop a malicious
// client from spamming the trainer.
exports.POST = withRoute(
  async ({ user, body }) => {
    const result = await categorize.suggest(user.id, body);
    return ApiResponse.ok(result);
  },
  {
    auth: true,
    schema: v.categorize,
    rateLimit: { bucket: 'default', windowMs: 60 * 1000, max: 60 },
  }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
