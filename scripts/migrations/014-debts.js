// Migration 014 — Debts & DebtRepayments collections + indexes.
//
// Idempotent. Just builds indexes — no backfill since debts is a new
// concept and existing data has nothing equivalent to migrate.
//
//   Usage: node scripts/migrations/014-debts.js

require('../_loadenv')({ verbose: false });

const mongoose = require('mongoose');
const connectDB = require('../../lib/db');
const Debt = require('../../lib/models/Debt');
const DebtRepayment = require('../../lib/models/DebtRepayment');
const logger = require('../../lib/utils/logger');

const NAME = '014-debts';

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
  await Debt.syncIndexes();
  await DebtRepayment.syncIndexes();
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
