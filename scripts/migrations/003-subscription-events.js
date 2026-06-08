// Migration 003 — Subscription events array, grace field, User.planValidUntil.
//
// Idempotent. Three changes:
//   1. Initialize `events: []` on every Subscription row that lacks it.
//   2. Initialize `gracePeriodUntil: null` on every Subscription row that lacks it.
//   3. Backfill `User.planValidUntil` from the matching Subscription's
//      `currentPeriodEnd` for premium users.
//   4. Build the WebhookEvent collection indexes.
//
//   Usage: node scripts/migrations/003-subscription-events.js

require('../_loadenv')({ verbose: false });

const mongoose = require('mongoose');
const connectDB = require('../../lib/db');
const Subscription = require('../../lib/models/Subscription');
const User = require('../../lib/models/User');
const WebhookEvent = require('../../lib/models/WebhookEvent');
const logger = require('../../lib/utils/logger');
const { SUBSCRIPTION_PLANS, SUBSCRIPTION_STATUS } = require('../../lib/config/constants');

const NAME = '003-subscription-events';

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

  // 1 + 2. Initialize new Subscription fields.
  const subResult = await Subscription.updateMany(
    {
      $or: [
        { events: { $exists: false } },
        { gracePeriodUntil: { $exists: false } },
        { lastReminderSentAt: { $exists: false } },
      ],
    },
    {
      $set: {
        events: [],
        gracePeriodUntil: null,
        lastReminderSentAt: null,
      },
    }
  );

  // 3. Backfill User.planValidUntil for active premium users.
  const activePremium = await Subscription.find({
    plan: SUBSCRIPTION_PLANS.PREMIUM,
    status: { $in: [SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.TRIALING] },
    currentPeriodEnd: { $exists: true, $ne: null },
  }).select('user currentPeriodEnd').lean();

  let usersBackfilled = 0;
  for (const sub of activePremium) {
    const res = await User.updateOne(
      { _id: sub.user, planValidUntil: { $in: [null, undefined] } },
      { $set: { planValidUntil: sub.currentPeriodEnd } }
    );
    usersBackfilled += res.modifiedCount || 0;
  }

  // Also stamp null on every other user so the field is materialized
  // (consistent with the rest of the schema's defaults).
  const userNullResult = await User.updateMany(
    { planValidUntil: { $exists: false } },
    { $set: { planValidUntil: null } }
  );

  // 4. Build WebhookEvent indexes.
  await WebhookEvent.syncIndexes();

  const durationMs = Date.now() - start;
  await Migrations.insertOne({
    name: NAME,
    appliedAt: new Date(),
    durationMs,
    subscriptionsBackfilled: subResult.modifiedCount,
    usersWithValidUntil: usersBackfilled,
    usersFieldMaterialized: userNullResult.modifiedCount,
  });

  logger.info(
    `Migration ${NAME} complete in ${durationMs}ms — subs:${subResult.modifiedCount} usersBackfilled:${usersBackfilled} usersMaterialized:${userNullResult.modifiedCount}`
  );
  await mongoose.disconnect();
  process.exit(0);
};

run().catch(async (err) => {
  logger.error(`Migration ${NAME} failed`, { message: err.message, stack: err.stack });
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
