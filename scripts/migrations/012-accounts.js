// Migration 012 — Accounts / Wallets foundation.
//
// Idempotent. Four effects:
//   1. Build the `accounts` collection indexes.
//   2. Seed a default "Cash" account per user (only when none exists).
//   3. Backfill `Expense.account` to point at the user's default Cash
//      account for any rows that still have a null account.
//   4. Recompute the cached balance on every Cash account so the dash
//      strip is non-zero on day one.
//
//   Usage: node scripts/migrations/012-accounts.js

require('../_loadenv')({ verbose: false });

const mongoose = require('mongoose');
const connectDB = require('../../lib/db');
const Account = require('../../lib/models/Account');
const User = require('../../lib/models/User');
const Expense = require('../../lib/models/Expense');
const logger = require('../../lib/utils/logger');
const { ACCOUNT_TYPES } = require('../../lib/config/constants');

const NAME = '012-accounts';

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

  await Account.syncIndexes();

  // 1. Seed default Cash account per user.
  const users = await User.find({ deletedAt: null })
    .select('_id preferences.currency')
    .lean();

  let accountsSeeded = 0;
  const userToCashAccountId = new Map();

  for (const u of users) {
    const existing = await Account.findOne({
      user: u._id,
      deletedAt: null,
      type: ACCOUNT_TYPES.CASH,
    });
    if (existing) {
      userToCashAccountId.set(String(u._id), existing._id);
      continue;
    }
    const created = await Account.create({
      user: u._id,
      name: 'Cash',
      type: ACCOUNT_TYPES.CASH,
      icon: 'payments',
      color: '#26A69A',
      currency: u.preferences?.currency || 'INR',
      openingBalance: 0,
      sortOrder: 0,
    });
    userToCashAccountId.set(String(u._id), created._id);
    accountsSeeded += 1;
  }

  // 2. Backfill Expense.account for rows that still have a null account.
  let expensesBackfilled = 0;
  for (const [userId, cashAccountId] of userToCashAccountId.entries()) {
    const res = await Expense.updateMany(
      {
        user: new mongoose.Types.ObjectId(userId),
        $or: [{ account: null }, { account: { $exists: false } }],
      },
      { $set: { account: cashAccountId } }
    );
    expensesBackfilled += res.modifiedCount || 0;
  }

  // 3. Recompute cached balance on every Cash account.
  let recomputed = 0;
  for (const cashAccountId of userToCashAccountId.values()) {
    const [agg] = await Expense.aggregate([
      { $match: { account: cashAccountId, deletedAt: null } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const totalDebits = agg?.total || 0;
    const account = await Account.findById(cashAccountId);
    if (account) {
      account.cachedBalance = (account.openingBalance || 0) - totalDebits;
      account.cachedBalanceAt = new Date();
      await account.save({ validateBeforeSave: false });
      recomputed += 1;
    }
  }

  // 4. The Expense index for `account` is added in the model definition;
  //    syncIndexes here rebuilds in case the model was loaded before
  //    this migration runs.
  await Expense.syncIndexes();

  const durationMs = Date.now() - start;
  await Migrations.insertOne({
    name: NAME,
    appliedAt: new Date(),
    durationMs,
    accountsSeeded,
    expensesBackfilled,
    accountsRecomputed: recomputed,
  });

  logger.info(
    `Migration ${NAME} complete in ${durationMs}ms — accounts:${accountsSeeded} expenses:${expensesBackfilled} recomputed:${recomputed}`
  );
  await mongoose.disconnect();
  process.exit(0);
};

run().catch(async (err) => {
  logger.error(`Migration ${NAME} failed`, { message: err.message, stack: err.stack });
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
