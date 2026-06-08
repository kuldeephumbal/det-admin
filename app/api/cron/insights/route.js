// Weekly AI insights cron — runs hourly; the service filters to
// users whose local time is Saturday 7am.
//
//   curl -H "x-cron-secret: $CRON_SECRET" \
//        https://your-app/api/cron/insights

const { NextResponse } = require('next/server');
const env = require('@/lib/config/env');
const connectDB = require('@/lib/db');
const logger = require('@/lib/utils/logger');
const insights = require('@/lib/services/ai/insights.service');

const unauthorized = () =>
  NextResponse.json(
    { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or missing cron secret' } },
    { status: 401 }
  );

const handler = async (req) => {
  const presented =
    req.headers.get('x-cron-secret') ||
    (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!presented || presented !== env.CRON_SECRET) return unauthorized();

  try {
    await connectDB();
    const result = await insights.runWeeklyDigest();
    logger.info('cron/insights complete', result);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    logger.error('cron/insights failed', { message: err.message, stack: err.stack });
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err.message } },
      { status: 500 }
    );
  }
};

exports.GET = handler;
exports.POST = handler;
