// Migration 009 — Financial score snapshots.
//
// Idempotent. Builds the unique (user, period.year, period.month)
// index and the history-read index. No backfill — scores compute
// on demand via the API or the monthly cron.
//
//   Usage: node scripts/migrations/009-financial-scores.js

require('../_loadenv')({ verbose: false });

const mongoose = require('mongoose');
const connectDB = require('../../lib/db');
const FinancialScoreSnapshot = require('../../lib/models/FinancialScoreSnapshot');
const logger = require('../../lib/utils/logger');

const NAME = '009-financial-scores';

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
  await FinancialScoreSnapshot.syncIndexes();
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
