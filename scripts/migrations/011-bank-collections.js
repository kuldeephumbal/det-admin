// Migration 011 — Bank connections + bank transactions.
//
// Idempotent. Builds indexes on the two new collections. The
// unique sparse index on Expense.externalId was already added by
// migration 010 (SMS rules) since the field is shared between the
// two import paths.
//
//   Usage: node scripts/migrations/011-bank-collections.js

require('../_loadenv')({ verbose: false });

const mongoose = require('mongoose');
const connectDB = require('../../lib/db');
const { BankConnection } = require('../../lib/models/BankConnection');
const { BankTransaction } = require('../../lib/models/BankTransaction');
const logger = require('../../lib/utils/logger');

const NAME = '011-bank-collections';

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
  await BankConnection.syncIndexes();
  await BankTransaction.syncIndexes();
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
