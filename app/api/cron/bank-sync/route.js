// Hourly bank-sync cron.
//
//   curl -H "x-cron-secret: $CRON_SECRET" \
//        https://your-app/api/cron/bank-sync
//
// Picks the next batch of due connections, syncs each, and stamps
// lastSyncedAt. Idempotent within an hour (the cutoff filter
// prevents re-syncing what we just did).

const { NextResponse } = require('next/server');
const env = require('@/lib/config/env');
const connectDB = require('@/lib/db');
const logger = require('@/lib/utils/logger');
const sync = require('@/lib/services/bank/sync.service');

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
    const result = await sync.runHourlySync();
    logger.info('cron/bank-sync complete', result);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    logger.error('cron/bank-sync failed', { message: err.message, stack: err.stack });
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err.message } },
      { status: 500 }
    );
  }
};

exports.GET = handler;
exports.POST = handler;
