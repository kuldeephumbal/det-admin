// Monthly financial-score recompute cron.
//
// Triggered on the 1st of each month — recomputes scores for the
// PREVIOUS calendar month, which is now closed. Optional shard
// parameter spreads the work across multiple invocations:
//
//   GET /api/cron/financial-score?shard=0&shardCount=4
//   GET /api/cron/financial-score?shard=1&shardCount=4
//   ...
//
// Per plan §10 scalability: ~50k users × ~10ms each = 8 min single-shard;
// sharding by user-id mod N parallelizes if the cron host can't sit
// blocked that long.

const { NextResponse } = require('next/server');
const env = require('@/lib/config/env');
const connectDB = require('@/lib/db');
const logger = require('@/lib/utils/logger');
const score = require('@/lib/services/ai/score.service');

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
    const url = new URL(req.url);
    const shard = url.searchParams.get('shard') !== null
      ? parseInt(url.searchParams.get('shard'), 10)
      : null;
    const shardCount = parseInt(url.searchParams.get('shardCount') || '1', 10);

    await connectDB();
    const result = await score.runMonthlyRecompute({ shard, shardCount });
    logger.info('cron/financial-score complete', result);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    logger.error('cron/financial-score failed', { message: err.message, stack: err.stack });
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err.message } },
      { status: 500 }
    );
  }
};

exports.GET = handler;
exports.POST = handler;
