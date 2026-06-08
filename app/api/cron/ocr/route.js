// OCR worker cron — processes pending ReceiptScan rows.
//
// Designed to be triggered every 1 minute (per plan §6). Idempotent:
// each tick claims a small batch via atomic findOneAndUpdate so
// concurrent ticks don't double-process.

const { NextResponse } = require('next/server');
const env = require('@/lib/config/env');
const connectDB = require('@/lib/db');
const logger = require('@/lib/utils/logger');
const receipts = require('@/lib/services/receipt.service');

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
    const result = await receipts.processPending({ batch: 5 });
    logger.info('cron/ocr complete', result);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    logger.error('cron/ocr failed', { message: err.message, stack: err.stack });
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err.message } },
      { status: 500 }
    );
  }
};

exports.GET = handler;
exports.POST = handler;
