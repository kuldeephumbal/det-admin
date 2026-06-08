// Materializes due recurring expenses.
//
//   curl -H "x-cron-secret: $CRON_SECRET" \
//        https://your-app/api/cron/recurring
//
// On Vercel: register this in vercel.json under "crons". On self-hosted:
// system cron (every 15 minutes is fine — the job is idempotent).

const { NextResponse } = require('next/server');
const env = require('@/lib/config/env');
const connectDB = require('@/lib/db');
const logger = require('@/lib/utils/logger');
const recurring = require('@/lib/services/recurring.service');
const savings = require('@/lib/services/savings.service');

const unauthorized = () =>
  NextResponse.json(
    { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or missing cron secret' } },
    { status: 401 }
  );

const handler = async (req) => {
  const presented =
    req.headers.get('x-cron-secret') ||
    // Vercel Cron sends Authorization: Bearer <CRON_SECRET> by convention.
    (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');

  if (!presented || presented !== env.CRON_SECRET) return unauthorized();

  try {
    await connectDB();
    const recurringResult = await recurring.runDueNow();
    const savingsResult = await savings.runAutoContributions();
    const result = { recurring: recurringResult, savings: savingsResult };
    logger.info('cron/recurring complete', result);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    logger.error('cron/recurring failed', { message: err.message, stack: err.stack });
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err.message } },
      { status: 500 }
    );
  }
};

// Allow GET (system cron) and POST (Vercel cron) — both behave the same.
exports.GET = handler;
exports.POST = handler;
