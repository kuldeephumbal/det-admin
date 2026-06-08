// Account / wallet service (Feature 13).
//
// Every monetary record in DET ultimately belongs to one Account. The
// service handles CRUD, the running-balance calculation (cached on the
// document for O(1) reads), and the internal transfer between two
// accounts (creates two paired Expense rows linked by `transferPair`).
//
// Balance derivation:
//   balance = openingBalance + Σ(credits) - Σ(debits)
// where every Expense row counts as a debit. Transfers from another
// account credit this one (paired Expense rows on the receiving side
// carry source='transfer' and a negative amount to signal credit).

const mongoose = require('mongoose');
const Account = require('../models/Account');
const Expense = require('../models/Expense');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { ACCOUNT_TYPES } = require('../config/constants');

const oid = (id) => new mongoose.Types.ObjectId(String(id));

// Default account every user gets on first login — keeps add-expense
// working without forcing a setup step.
const DEFAULT_CASH_ACCOUNT = {
  name: 'Cash',
  type: ACCOUNT_TYPES.CASH,
  icon: 'payments',
  color: '#26A69A',
  openingBalance: 0,
  sortOrder: 0,
};

// Per-user soft cap. Wallet's free tier allows 3 accounts; we'll match
// that for now and gate higher counts behind premium when monetisation
// lands.
const MAX_ACCOUNTS_PER_USER = 25;

const toPublic = (doc, { balance } = {}) => ({
  id: String(doc._id),
  name: doc.name,
  type: doc.type,
  icon: doc.icon || 'wallet',
  color: doc.color || '#5B7CFA',
  currency: doc.currency,
  openingBalance: doc.openingBalance || 0,
  balance: balance ?? doc.cachedBalance ?? doc.openingBalance ?? 0,
  accountMask: doc.accountMask || '',
  isArchived: !!doc.isArchived,
  excludeFromTotals: !!doc.excludeFromTotals,
  sortOrder: doc.sortOrder || 0,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

// ---------- Balance ----------

// Recompute the cached balance for ONE account. Called after every write
// that touches an Expense linked to the account. Cheap — single
// $group aggregation indexed on (user, account).
const _recomputeBalance = async (accountId) => {
  const account = await Account.findById(accountId);
  if (!account) return 0;

  const [agg] = await Expense.aggregate([
    {
      $match: {
        account: account._id,
        deletedAt: null,
      },
    },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  // Expenses are debits (amount > 0 reduces balance). Transfer-credit
  // rows store a negative amount so they ADD to balance naturally.
  const totalDebits = agg?.total || 0;
  const balance = (account.openingBalance || 0) - totalDebits;

  account.cachedBalance = balance;
  account.cachedBalanceAt = new Date();
  await account.save({ validateBeforeSave: false });
  return balance;
};

// Public hook other services call after they touch an Expense — keeps
// the cached balance consistent without coupling every write site to
// the aggregation pipeline above.
const touchAccount = async (accountId) => {
  if (!accountId) return null;
  try {
    return await _recomputeBalance(accountId);
  } catch (err) {
    logger.warn('account.touch failed', {
      accountId: String(accountId),
      message: err.message,
    });
    return null;
  }
};

// ---------- CRUD ----------

const ensureDefaultForUser = async (userId) => {
  const existing = await Account.findOne({
    user: oid(userId),
    deletedAt: null,
    type: ACCOUNT_TYPES.CASH,
  });
  if (existing) return existing;

  const user = await User.findById(userId).select('preferences.currency').lean();
  const created = await Account.create({
    ...DEFAULT_CASH_ACCOUNT,
    user: oid(userId),
    currency: user?.preferences?.currency || 'INR',
  });
  return created;
};

const list = async (userId, { includeArchived = false } = {}) => {
  // Shared-accounts (Feature 16): pull the union of owned accounts +
  // active memberships. Lazy require to avoid the circular reference
  // between account.service and sharing.service.
  const sharing = require('./sharing.service');
  const accessibleIds = await sharing.accessibleAccountIds(userId);

  const filter = { _id: { $in: accessibleIds }, deletedAt: null };
  if (!includeArchived) filter.isArchived = false;
  const docs = await Account.find(filter)
    .sort({ sortOrder: 1, createdAt: 1 })
    .lean();

  // Mark which rows are shared (i.e. owned by someone else) so the
  // mobile chip can render a "Shared" badge without a second query.
  return {
    items: docs.map((d) => ({
      ...toPublic(d),
      isShared: String(d.user) !== String(userId),
    })),
  };
};

const get = async (userId, id) => {
  // Direct ownership OR active membership both grant read access.
  const sharing = require('./sharing.service');
  const access = await sharing.isAccessible(userId, id);
  if (!access.accessible) throw ApiError.notFound('Account not found');

  const doc = await Account.findOne({ _id: id, deletedAt: null }).lean();
  if (!doc) throw ApiError.notFound('Account not found');
  return {
    ...toPublic(doc),
    isShared: String(doc.user) !== String(userId),
    role: access.role,
  };
};

const create = async (userId, payload) => {
  const count = await Account.countDocuments({
    user: oid(userId),
    deletedAt: null,
    isArchived: false,
  });
  if (count >= MAX_ACCOUNTS_PER_USER) {
    throw ApiError.badRequest(
      `You already have ${MAX_ACCOUNTS_PER_USER} active accounts — archive one before adding more`
    );
  }

  const doc = await Account.create({
    ...payload,
    user: oid(userId),
    cachedBalance: payload.openingBalance || 0,
    cachedBalanceAt: new Date(),
  });
  return toPublic(doc);
};

const update = async (userId, id, patch) => {
  const doc = await Account.findOneAndUpdate(
    { _id: id, user: oid(userId), deletedAt: null },
    { $set: patch },
    { new: true, runValidators: true, context: 'query' }
  );
  if (!doc) throw ApiError.notFound('Account not found');
  return toPublic(doc.toObject());
};

// Soft-delete. Refuses if the account has live expenses linked — users
// should archive in that case, not delete.
const softDelete = async (userId, id) => {
  const account = await Account.findOne({
    _id: id,
    user: oid(userId),
    deletedAt: null,
  });
  if (!account) throw ApiError.notFound('Account not found');

  const hasExpenses = await Expense.exists({
    account: account._id,
    deletedAt: null,
  });
  if (hasExpenses) {
    throw ApiError.conflict(
      'Account has expenses — archive it instead of deleting',
      { field: 'account' }
    );
  }

  account.deletedAt = new Date();
  account.isArchived = true;
  await account.save();
};

// ---------- Transfer ----------
//
// Internal transfer between two of the user's accounts. Creates two
// paired Expense rows:
//   - From-account: positive amount, source='transfer'
//   - To-account:   negative amount, source='transfer' (acts as credit)
// Both share a `transferPair` ObjectId so analytics can group them.

const transfer = async (userId, fromAccountId, { toAccount, amount, occurredAt, note }) => {
  if (String(fromAccountId) === String(toAccount)) {
    throw ApiError.badRequest('Source and destination accounts must differ');
  }

  const [from, to] = await Promise.all([
    Account.findOne({ _id: fromAccountId, user: oid(userId), deletedAt: null }),
    Account.findOne({ _id: toAccount, user: oid(userId), deletedAt: null }),
  ]);
  if (!from) throw ApiError.notFound('Source account not found');
  if (!to) throw ApiError.notFound('Destination account not found');
  if (from.isArchived || to.isArchived) {
    throw ApiError.badRequest('Cannot transfer to/from an archived account');
  }

  const pair = new mongoose.Types.ObjectId();
  const when = occurredAt || new Date();
  const noteText = note?.trim() || `Transfer ${from.name} → ${to.name}`;

  // The transfer rows need a category — Expense has `required: true` on
  // category. Use null + service-level allowance? No — keep the model
  // strict. Plumbing a "Transfer" system category needs a follow-up;
  // for now require the user to have at least one category and use
  // their first.
  //
  // TODO(account/transfer-category): seed a system "Transfer" category
  // that's hidden from picker but available here. Until then, the
  // route layer enforces that the user has set up their categories.
  const Category = require('../models/Category');
  let category = await Category.findOne({
    $or: [{ user: oid(userId) }, { user: null, isDefault: true }],
    deletedAt: null,
    isActive: true,
  }).select('_id').lean();
  if (!category) {
    throw ApiError.badRequest(
      'Cannot transfer without any categories set up. Add a category first.'
    );
  }

  const [debit, credit] = await Promise.all([
    Expense.create({
      user: oid(userId),
      amount,
      currency: from.currency,
      category: category._id,
      account: from._id,
      date: when,
      note: noteText,
      paymentMethod: 'other',
      source: 'transfer',
      transferPair: pair,
    }),
    Expense.create({
      user: oid(userId),
      // Negative on the receiving side so the receiving account's
      // running balance increases when this row is summed in.
      amount: -amount,
      currency: to.currency,
      category: category._id,
      account: to._id,
      date: when,
      note: noteText,
      paymentMethod: 'other',
      source: 'transfer',
      transferPair: pair,
    }),
  ]);

  await Promise.all([touchAccount(from._id), touchAccount(to._id)]);

  return {
    fromExpense: String(debit._id),
    toExpense: String(credit._id),
    transferPair: String(pair),
    amount,
    currency: from.currency,
  };
};

// ---------- Net worth ----------
//
// Sum of all non-archived, non-excluded accounts. For mixed-currency
// users the response groups by currency — multi-currency conversion is
// a Phase 5 follow-up once we add an FX provider.

const netWorth = async (userId) => {
  const docs = await Account.find({
    user: oid(userId),
    deletedAt: null,
    isArchived: false,
    excludeFromTotals: false,
  })
    .select('currency cachedBalance')
    .lean();

  const byCurrency = {};
  for (const a of docs) {
    const cur = a.currency || 'INR';
    byCurrency[cur] = (byCurrency[cur] || 0) + (a.cachedBalance || 0);
  }
  return {
    byCurrency,
    accounts: docs.length,
  };
};

module.exports = {
  list,
  get,
  create,
  update,
  softDelete,
  transfer,
  netWorth,
  ensureDefaultForUser,
  touchAccount,
  MAX_ACCOUNTS_PER_USER,
};
