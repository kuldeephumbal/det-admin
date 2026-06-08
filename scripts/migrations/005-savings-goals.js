// Migration 005 — Savings Goals collections + indexes.
//
// Idempotent. Builds the indexes on the two new collections so production
// reads (status by user, contributions ordered by date) don't pay an
// index-build penalty on first traffic.
//
//   Usage: node scripts/migrations/005-savings-goals.js

require('../_loadenv')({ verbose: false });

const mongoose = require('mongoose');
const connectDB = require('../../lib/db');
const { SavingsGoal } = require('../../lib/models/SavingsGoal');
const { GoalContribution } = require('../../lib/models/GoalContribution');
const logger = require('../../lib/utils/logger');

const NAME = '005-savings-goals';

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
  await SavingsGoal.syncIndexes();
  await GoalContribution.syncIndexes();
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
