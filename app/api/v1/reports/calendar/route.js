const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const analytics = require('@/lib/services/analytics.service');
const v = require('@/lib/validators/analytics.validator');

// GET /api/v1/reports/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
//
// Returns one entry per day in the range (zero-filled), bucketed in
// the caller's preferences.timezone. 60-day cap per request — the
// mobile UI pages by month, well under that.
exports.GET = withRoute(
  async ({ user, query }) => ApiResponse.ok(await analytics.calendar(user.id, query)),
  { auth: true, schema: v.calendar }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
