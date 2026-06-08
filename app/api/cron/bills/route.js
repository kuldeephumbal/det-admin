// Daily bills cron.
//
// Walks every unpaid bill whose dueDate falls in the upcoming-reminder
// window and fires push notifications for the appropriate T-N marker
// (T-3 / T-1 / day-of) plus overdue alerts for anything past due.
//
//   curl -H "x-cron-secret: $CRON_SECRET" \
//        https://your-app/api/cron/bills

const { NextResponse } = require('next/server');
const env = require('@/lib/config/env');
const connectDB = require('@/lib/db');
const logger = require('@/lib/utils/logger');
const bills = require('@/lib/services/bill.service');

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
    const result = await bills.runDailyReminders();
    logger.info('cron/bills complete', result);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    logger.error('cron/bills failed', { message: err.message, stack: err.stack });
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err.message } },
      { status: 500 }
    );
  }
};

exports.GET = handler;
exports.POST = handler;
