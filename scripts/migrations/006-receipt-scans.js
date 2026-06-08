// Migration 006 — Receipt scans collection + indexes + failed-TTL.
//
// Idempotent. Two effects:
//   1. Build the indexes Mongoose defines on the ReceiptScan model,
//      including the partial-TTL on failed scans (30 days).
//   2. Ensure the var/uploads directory exists when the storage
//      provider is `local` (dev convenience).
//
//   Usage: node scripts/migrations/006-receipt-scans.js

require('../_loadenv')({ verbose: false });

const fs = require('fs/promises');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../../lib/db');
const { ReceiptScan } = require('../../lib/models/ReceiptScan');
const env = require('../../lib/config/env');
const logger = require('../../lib/utils/logger');

const NAME = '006-receipt-scans';

const run = async () => {
  await connectDB();
  const Migrations = mongoose.connection.collection('_migrations');

  const prior = await Migrations.findOne({ name: NAME });
  if (prior) {
    logger.info(`Migration ${NAME} already applied at ${prior.appliedAt.toISOString()} — skipping`);
    await mongoose.disconnect();
    process.exit(0);
  }

  const start = Date.now();
  await ReceiptScan.syncIndexes();

  if (env.STORAGE_PROVIDER === 'local') {
    const uploadDir = path.resolve(process.cwd(), 'var', 'uploads');
    await fs.mkdir(uploadDir, { recursive: true });
  }

  const durationMs = Date.now() - start;
  await Migrations.insertOne({ name: NAME, appliedAt: new Date(), durationMs });
  logger.info(`Migration ${NAME} complete in ${durationMs}ms`);
  await mongoose.disconnect();
  process.exit(0);
};

run().catch(async (err) => {
  logger.error(`Migration ${NAME} failed`, { message: err.message, stack: err.stack });
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
