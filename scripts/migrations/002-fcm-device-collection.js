// Migration 002 — FCM device registry + Notification.pushDelivery.
//
// Two changes, idempotent:
//   1. Build the `devices` collection's compound + sparse-unique indexes
//      ahead of first use (Mongoose creates them lazily, but doing it here
//      surfaces collisions before production traffic hits the model).
//   2. Stamp default `pushDelivery` and `deepLink` fields onto existing
//      Notification rows so the new schema's transforms / projections
//      have something stable to return.
//
//   Usage: node scripts/migrations/002-fcm-device-collection.js

require('../_loadenv')({ verbose: false });

const mongoose = require('mongoose');
const connectDB = require('../../lib/db');
const Device = require('../../lib/models/Device');
const Notification = require('../../lib/models/Notification');
const logger = require('../../lib/utils/logger');

const NAME = '002-fcm-device-collection';

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

  // 1. Ensure device indexes exist.
  await Device.syncIndexes();

  // 2. Backfill defaults on existing Notification rows.
  const notifResult = await Notification.updateMany(
    {
      $or: [
        { pushDelivery: { $exists: false } },
        { deepLink: { $exists: false } },
      ],
    },
    {
      $set: {
        'pushDelivery.attemptedAt': null,
        'pushDelivery.succeededCount': 0,
        'pushDelivery.failedCount': 0,
        'pushDelivery.lastError': '',
        deepLink: '',
      },
    }
  );

  const durationMs = Date.now() - start;
  await Migrations.insertOne({
    name: NAME,
    appliedAt: new Date(),
    durationMs,
    notificationsBackfilled: notifResult.modifiedCount,
  });

  logger.info(
    `Migration ${NAME} complete — backfilled ${notifResult.modifiedCount} notifications in ${durationMs}ms`
  );
  await mongoose.disconnect();
  process.exit(0);
};

run().catch(async (err) => {
  logger.error(`Migration ${NAME} failed`, { message: err.message, stack: err.stack });
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
