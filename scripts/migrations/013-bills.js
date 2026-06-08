// Migration 013 — Bills & Planned Payments collection + indexes.
//
// Idempotent. Just builds indexes — there's no backfill since Bills is
// a new concept and existing data has nothing equivalent to migrate.
//
//   Usage: node scripts/migrations/013-bills.js

require('../_loadenv')({ verbose: false });

const mongoose = require('mongoose');
const connectDB = require('../../lib/db');
const Bill = require('../../lib/models/Bill');
const logger = require('../../lib/utils/logger');

const NAME = '013-bills';

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
  await Bill.syncIndexes();
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
