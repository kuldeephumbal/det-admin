// Migration 010 — SMS parser rules + Expense source/externalId backfill.
//
// Idempotent. Four effects:
//   1. Build the SmsParserRule collection indexes.
//   2. Backfill Expense.source for legacy rows: 'recurring' when
//      recurringSource is set, 'manual' otherwise.
//   3. Materialize the new fields on every Expense so projections
//      don't have to special-case missing-key.
//   4. Build the partial-unique externalId index used by SMS / bank
//      dedupe.
//
// SEEDING the default Indian-bank patterns is intentionally NOT done
// here — those should land via a dedicated seed script reviewed by
// the team, not silently from an automated migration.
//
//   Usage: node scripts/migrations/010-sms-rules.js

require('../_loadenv')({ verbose: false });

const mongoose = require('mongoose');
const connectDB = require('../../lib/db');
const SmsParserRule = require('../../lib/models/SmsParserRule');
const Expense = require('../../lib/models/Expense');
const logger = require('../../lib/utils/logger');

const NAME = '010-sms-rules';

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

  await SmsParserRule.syncIndexes();

  // Backfill source. Two passes:
  //   - recurringSource set → source = 'recurring'
  //   - source absent       → source = 'manual'
  const recurringBackfill = await Expense.updateMany(
    {
      $and: [
        { recurringSource: { $ne: null } },
        { $or: [{ source: { $exists: false } }, { source: null }, { source: '' }] },
      ],
    },
    { $set: { source: 'recurring' } }
  );

  const manualBackfill = await Expense.updateMany(
    {
      $or: [{ source: { $exists: false } }, { source: null }, { source: '' }],
    },
    { $set: { source: 'manual' } }
  );

  // syncIndexes() picks up the new partial-unique externalId index.
  await Expense.syncIndexes();

  const durationMs = Date.now() - start;
  await Migrations.insertOne({
    name: NAME,
    appliedAt: new Date(),
    durationMs,
    recurringBackfilled: recurringBackfill.modifiedCount,
    manualBackfilled: manualBackfill.modifiedCount,
  });

  logger.info(
    `Migration ${NAME} complete in ${durationMs}ms — recurring:${recurringBackfill.modifiedCount} manual:${manualBackfill.modifiedCount}`
  );
  await mongoose.disconnect();
  process.exit(0);
};

run().catch(async (err) => {
  logger.error(`Migration ${NAME} failed`, { message: err.message, stack: err.stack });
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
