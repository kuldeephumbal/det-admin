// Bank sync orchestrator.
//
// Pulls fresh transactions from the provider, three-way-dedupes them
// against existing manual + SMS-imported Expense rows, and persists.
//
// Dedupe key (per plan §12): `(amount, day, merchant-normalized)`.
// A bank transaction landing in the same 1-day window as a manual or
// SMS-imported expense with the same rupee amount and matching merchant
// prefix is treated as the same real-world spend — the bank row wins
// (more reliable amount + merchant), the duplicate is hidden via the
// existing Expense's `source = 'bank-sync'` flip.

const mongoose = require('mongoose');
const { BankConnection } = require('../../models/BankConnection');
const { BankTransaction } = require('../../models/BankTransaction');
const Expense = require('../../models/Expense');
const ApiError = require('../../utils/ApiError');
const logger = require('../../utils/logger');
const env = require('../../config/env');
const encryption = require('../../utils/encryption');
const bank = require('./index');

const oid = (id) => new mongoose.Types.ObjectId(String(id));

const SYNC_LOOKBACK_DAYS = 30;
const DEDUPE_WINDOW_HOURS = 30; // a touch over a day to absorb tz wobble
const MERCHANT_PREFIX_LEN = 6;

// ---------- Token sealing ----------

const sealToken = (plaintext) => encryption.encrypt(plaintext, env.BANK_TOKEN_ENC_KEY);
const unsealToken = (envelope) => encryption.decrypt(envelope, env.BANK_TOKEN_ENC_KEY);

// ---------- Dedupe ----------

const _normalizeMerchant = (s) =>
  (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, MERCHANT_PREFIX_LEN);

const _findExpenseMatch = async (userId, txn) => {
  const merchantKey = _normalizeMerchant(txn.merchant);
  const windowMs = DEDUPE_WINDOW_HOURS * 3600_000;
  const from = new Date(txn.occurredAt.getTime() - windowMs);
  const to = new Date(txn.occurredAt.getTime() + windowMs);
  const target = Math.abs(txn.amount);

  // Pull candidates by date+amount window first, then dedupe on
  // normalized merchant in memory — keeps the index hit cheap.
  const candidates = await Expense.find({
    user: oid(userId),
    deletedAt: null,
    source: { $in: ['manual', 'sms', 'recurring'] },
    date: { $gte: from, $lte: to },
    amount: { $gte: target - 0.01, $lte: target + 0.01 },
  }).limit(20).lean();

  if (candidates.length === 0) return null;
  if (!merchantKey) return candidates[0]; // amount + day match alone is good enough
  return (
    candidates.find((c) => _normalizeMerchant(c.note) === merchantKey)
    || candidates[0]
  );
};

// ---------- Sync ----------

const syncConnection = async (connectionId, { categorize = false } = {}) => {
  const conn = await BankConnection.findById(connectionId).select('+accessTokenEncrypted');
  if (!conn) throw ApiError.notFound('Bank connection not found');
  if (conn.status !== 'active') {
    return { synced: 0, deduped: 0, skipped: true, reason: conn.status };
  }

  const { adapter } = bank.get(conn.provider);
  const accessToken = unsealToken(conn.accessTokenEncrypted);

  const since = new Date(Date.now() - SYNC_LOOKBACK_DAYS * 86400_000);
  const transactions = await adapter.fetchTransactions({ accessToken, since });

  let synced = 0;
  let deduped = 0;
  for (const t of transactions) {
    // Skip if we've already ingested this provider txn for this user.
    const existing = await BankTransaction.findOne({
      user: conn.user,
      externalId: t.externalId,
    }).lean();
    if (existing) continue;

    const match = await _findExpenseMatch(conn.user, t);

    let expenseId = null;
    let dedupeStrategy = 'new';

    if (match) {
      // Fuse: keep the existing Expense, mark its source as bank-sync,
      // stamp the externalId so subsequent SMS imports collide.
      await Expense.updateOne(
        { _id: match._id },
        {
          $set: {
            source: 'bank-sync',
            externalId: t.externalId,
            amount: t.amount,
            note: t.merchant || match.note || '',
          },
        }
      );
      expenseId = match._id;
      dedupeStrategy = match.source === 'sms' ? 'merged-sms' : 'merged-manual';
      deduped += 1;
    } else {
      // New row. Category is left null — the categorizer (Feature 12
      // step 5) will tag it asynchronously. Until that adapter ships,
      // unmapped transactions sit in an "uncategorized" bucket.
      const expense = await Expense.create({
        user: conn.user,
        amount: t.amount,
        currency: t.currency || conn.currency || 'INR',
        category: null,
        date: t.occurredAt,
        note: t.merchant || '',
        paymentMethod: 'card',
        source: 'bank-sync',
        externalId: t.externalId,
      });
      expenseId = expense._id;
      synced += 1;
    }

    await BankTransaction.create({
      user: conn.user,
      connection: conn._id,
      externalId: t.externalId,
      amount: t.amount,
      currency: t.currency || conn.currency || 'INR',
      merchant: t.merchant || '',
      occurredAt: t.occurredAt,
      type: t.type,
      raw: t.raw || null,
      expense: expenseId,
      dedupeStrategy,
    });
  }

  conn.lastSyncedAt = new Date();
  conn.lastError = '';
  await conn.save();

  return { synced, deduped, total: transactions.length };
};

const syncAllForUser = async (userId) => {
  const conns = await BankConnection.find({ user: oid(userId), status: 'active' });
  let total = 0;
  let deduped = 0;
  for (const c of conns) {
    try {
      const r = await syncConnection(c._id);
      total += r.synced || 0;
      deduped += r.deduped || 0;
    } catch (err) {
      logger.warn('bank.syncConnection failed', { connectionId: String(c._id), message: err.message });
      c.lastError = err.message;
      c.status = err.code === 'BANK_NOT_CONFIGURED' ? 'error' : c.status;
      await c.save();
    }
  }
  return { synced: total, deduped };
};

// Cron entry — sync every active connection that hasn't been synced
// within the last hour. Bounded by limit so the cron tick doesn't
// run away.
const runHourlySync = async ({ limit = 100, now = new Date() } = {}) => {
  const cutoff = new Date(now.getTime() - 60 * 60_000);
  const due = await BankConnection.find({
    status: 'active',
    $or: [{ lastSyncedAt: null }, { lastSyncedAt: { $lte: cutoff } }],
  })
    .sort({ lastSyncedAt: 1 })
    .limit(limit);

  let connectionsSynced = 0;
  let transactionsSynced = 0;
  let transactionsDeduped = 0;
  for (const c of due) {
    try {
      const r = await syncConnection(c._id);
      connectionsSynced += 1;
      transactionsSynced += r.synced || 0;
      transactionsDeduped += r.deduped || 0;
    } catch (err) {
      logger.warn('bank.runHourlySync row failed', {
        connectionId: String(c._id),
        message: err.message,
      });
    }
  }
  return { connectionsSynced, transactionsSynced, transactionsDeduped };
};

module.exports = {
  syncConnection,
  syncAllForUser,
  runHourlySync,
  sealToken,
  unsealToken,
};
