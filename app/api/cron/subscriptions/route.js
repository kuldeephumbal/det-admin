// Daily subscription maintenance cron.
//
//   1. Expire subscriptions past their grace period (or past
//      currentPeriodEnd if cancelled).
//   2. Send T-7 / T-3 / T-1 renewal reminders.
//
//   curl -H "x-cron-secret: $CRON_SECRET" \
//        https://your-app/api/cron/subscriptions
//
// Idempotent: same calendar day = same effect.

const { NextResponse } = require('next/server');
const env = require('@/lib/config/env');
const connectDB = require('@/lib/db');
const logger = require('@/lib/utils/logger');
const subscriptions = require('@/lib/services/subscription.service');

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
    const result = await subscriptions.runDaily();
    logger.info('cron/subscriptions complete', result);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    logger.error('cron/subscriptions failed', { message: err.message, stack: err.stack });
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err.message } },
      { status: 500 }
    );
  }
};

exports.GET = handler;
exports.POST = handler;
