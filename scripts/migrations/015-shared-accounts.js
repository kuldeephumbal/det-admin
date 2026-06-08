// Migration 015 — Shared accounts (AccountMembership) collection + indexes.
//
// Idempotent. Builds the indexes defined on the model: the unique
// (account, user) pair, plus the two lookup indexes that drive the
// "my pending invitations" inbox and the "members on this account"
// owner view. No backfill — every existing account is implicitly an
// owner-only single-member account, and the membership row is created
// lazily the first time the owner invites someone.
//
//   Usage: node scripts/migrations/015-shared-accounts.js

require('../_loadenv')({ verbose: false });

const mongoose = require('mongoose');
const connectDB = require('../../lib/db');
const AccountMembership = require('../../lib/models/AccountMembership');
const logger = require('../../lib/utils/logger');

const NAME = '015-shared-accounts';

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
  await AccountMembership.syncIndexes();
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
