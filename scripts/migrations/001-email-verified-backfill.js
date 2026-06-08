// Migration 001 — Email verification backfill.
//
// Grandfathers every pre-existing user account by stamping
// `emailVerifiedAt = createdAt` for any row where the field is still
// null. New rows arriving after this migration go through the regular
// verification flow.
//
// Idempotent: re-running only touches users still missing the field.
// Records its result in the `_migrations` collection.
//
//   Usage: node scripts/migrations/001-email-verified-backfill.js

require('../_loadenv')({ verbose: false });

const mongoose = require('mongoose');
const connectDB = require('../../lib/db');
const User = require('../../lib/models/User');
const logger = require('../../lib/utils/logger');

const NAME = '001-email-verified-backfill';

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
  const result = await User.updateMany(
    { emailVerifiedAt: null, createdAt: { $exists: true } },
    [{ $set: { emailVerifiedAt: '$createdAt' } }]
  );

  const durationMs = Date.now() - start;
  await Migrations.insertOne({
    name: NAME,
    appliedAt: new Date(),
    durationMs,
    affected: result.modifiedCount,
  });

  logger.info(
    `Migration ${NAME} complete — ${result.modifiedCount} users grandfathered in ${durationMs}ms`
  );
  await mongoose.disconnect();
  process.exit(0);
};

run().catch(async (err) => {
  logger.error(`Migration ${NAME} failed`, { message: err.message, stack: err.stack });
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
