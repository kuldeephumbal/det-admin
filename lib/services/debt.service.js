// Debts service (Feature 15).
//
// Two-way lend/borrow ledger. A Debt carries `originalAmount`,
// `outstanding`, and a `status` flag. DebtRepayment rows are the
// individual events that chip away at `outstanding`. Each repayment
// optionally creates a paired Expense so the user's account balance
// stays accurate:
//
//   borrowed-debt repayment → Expense (debit, source='debt-repayment')
//   lent-debt    repayment → Expense (credit i.e. negative amount,
//                                       source='debt-repayment')
//
// Analytics that compute "spending" should exclude
// source in ('transfer', 'debt-repayment') so neither bumps the user's
// expense series — they're internal balance moves, not real outflows.

const mongoose = require('mongoose');
const Debt = require('../models/Debt');
const DebtRepayment = require('../models/DebtRepayment');
const Category = require('../models/Category');
const Account = require('../models/Account');
const Expense = require('../models/Expense');
const ApiError = require('../utils/ApiError');
const { parsePagination } = require('../utils/pagination');

const oid = (id) => new mongoose.Types.ObjectId(String(id));

const toPublic = (d) => ({
  id: String(d._id),
  type: d.type,
  counterparty: d.counterparty,
  originalAmount: d.originalAmount,
  outstanding: d.outstanding,
  currency: d.currency,
  account: d.account ? String(d.account) : null,
  dueDate: d.dueDate || null,
  note: d.note || '',
  status: d.status,
  settledAt: d.settledAt || null,
  createdAt: d.createdAt,
  updatedAt: d.updatedAt,
});

const toPublicRepayment = (r) => ({
  id: String(r._id),
  debtId: String(r.debt),
  amount: r.amount,
  occurredAt: r.occurredAt,
  account: r.account ? String(r.account) : null,
  expense: r.expense ? String(r.expense) : null,
  note: r.note || '',
  createdAt: r.createdAt,
});

// ---------- Helpers ----------

const _ensureAccount = async (userId, accountId) => {
  if (!accountId) return;
  const a = await Account.findOne({
    _id: accountId,
    user: oid(userId),
    deletedAt: null,
  }).lean();
  if (!a) throw ApiError.badRequest('Invalid account');
};

const _ensureCategory = async (userId, categoryId) => {
  if (!categoryId) return;
  const c = await Category.findOne({
    _id: categoryId,
    deletedAt: null,
    $or: [{ user: userId }, { isDefault: true, user: null }],
  }).lean();
  if (!c) throw ApiError.badRequest('Invalid category');
};

// Recompute the cached `outstanding` from the live repayment rows.
// Source of truth for the settled/outstanding flip.
const _recompute = async (debt) => {
  const [agg] = await DebtRepayment.aggregate([
    { $match: { debt: debt._id, deletedAt: null } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const repaid = Math.max(0, agg?.total || 0);
  const outstanding = Math.max(0, debt.originalAmount - repaid);
  debt.outstanding = outstanding;
  if (outstanding === 0 && debt.status !== 'settled') {
    debt.status = 'settled';
    debt.settledAt = new Date();
  } else if (outstanding > 0 && debt.status === 'settled') {
    // Edge case: a repayment was removed and we're back in the red.
    debt.status = 'outstanding';
    debt.settledAt = null;
  }
  await debt.save();
  return debt;
};

// ---------- CRUD ----------

const list = async (userId, q = {}) => {
  const { page, limit, skip } = parsePagination(q);
  const filter = { user: oid(userId), deletedAt: null };
  if (q.status && q.status !== 'all') filter.status = q.status;
  if (q.type) filter.type = q.type;

  // Outstanding first (asc by dueDate when present, otherwise createdAt),
  // then settled (most recently settled first).
  const sort = filter.status === 'settled' ? { settledAt: -1 } : { dueDate: 1, createdAt: -1 };

  const [items, total] = await Promise.all([
    Debt.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Debt.countDocuments(filter),
  ]);
  return { items: items.map(toPublic), page, limit, total };
};

const get = async (userId, id) => {
  const doc = await Debt.findOne({
    _id: id,
    user: oid(userId),
    deletedAt: null,
  }).lean();
  if (!doc) throw ApiError.notFound('Debt not found');
  return toPublic(doc);
};

const create = async (userId, payload) => {
  await _ensureAccount(userId, payload.account);
  const doc = await Debt.create({
    user: oid(userId),
    type: payload.type,
    counterparty: payload.counterparty,
    originalAmount: payload.amount,
    outstanding: payload.amount,
    currency: payload.currency || 'INR',
    account: payload.account || null,
    dueDate: payload.dueDate || null,
    note: payload.note || '',
  });
  return toPublic(doc);
};

const update = async (userId, id, patch) => {
  if (patch.account) await _ensureAccount(userId, patch.account);

  const debt = await Debt.findOne({
    _id: id,
    user: oid(userId),
    deletedAt: null,
  });
  if (!debt) throw ApiError.notFound('Debt not found');

  // If `amount` is being changed, refuse when any repayment has been
  // recorded — the user should record an adjustment-repayment instead.
  if (patch.amount && patch.amount !== debt.originalAmount) {
    const hasRepayments = await DebtRepayment.exists({
      debt: debt._id,
      deletedAt: null,
    });
    if (hasRepayments) {
      throw ApiError.badRequest(
        'Cannot change original amount once repayments are recorded'
      );
    }
    debt.originalAmount = patch.amount;
    debt.outstanding = patch.amount;
  }
  if (patch.counterparty !== undefined) debt.counterparty = patch.counterparty;
  if (patch.currency) debt.currency = patch.currency;
  if (patch.account !== undefined) debt.account = patch.account;
  if (patch.dueDate !== undefined) debt.dueDate = patch.dueDate;
  if (patch.note !== undefined) debt.note = patch.note;
  await debt.save();
  return toPublic(debt);
};

const softDelete = async (userId, id) => {
  const debt = await Debt.findOneAndUpdate(
    { _id: id, user: oid(userId), deletedAt: null },
    { $set: { deletedAt: new Date() } }
  );
  if (!debt) throw ApiError.notFound('Debt not found');
};

// ---------- Repayments ----------

const recordRepayment = async (userId, debtId, payload) => {
  const debt = await Debt.findOne({
    _id: debtId,
    user: oid(userId),
    deletedAt: null,
  });
  if (!debt) throw ApiError.notFound('Debt not found');
  if (debt.status === 'settled') {
    throw ApiError.badRequest('Debt is already settled');
  }

  const amount = payload.amount;
  const account = payload.account || debt.account;
  await _ensureAccount(userId, account);
  await _ensureCategory(userId, payload.category);

  // Resolve a category for the Expense — required by the Expense schema.
  let resolvedCategory = payload.category;
  if (!resolvedCategory) {
    const cat = await Category.findOne({
      $or: [{ user: oid(userId) }, { isDefault: true, user: null }],
      deletedAt: null,
      isActive: true,
    }).select('_id').lean();
    if (!cat) {
      throw ApiError.badRequest(
        'No category to attribute the repayment to — add a category first'
      );
    }
    resolvedCategory = cat._id;
  }

  // Mint the Expense. Sign depends on direction:
  //   borrowed-debt repayment → debit  (positive amount, real spend)
  //   lent-debt     repayment → credit (negative amount, just a balance move)
  //
  // The schema-level min:0 was removed on Expense.amount specifically
  // for this case; the public /expenses Joi still enforces positive.
  const signed = debt.type === 'borrowed' ? amount : -amount;
  const expenseService = require('./expense.service');
  const expense = await expenseService.create(userId, {
    amount: signed,
    currency: debt.currency,
    category: resolvedCategory,
    account,
    date: payload.occurredAt || new Date(),
    note:
      payload.note ||
      `${debt.type === 'borrowed' ? 'Repaid' : 'Received from'} ${debt.counterparty}`,
    paymentMethod: 'other',
  });

  // expense.service.create defaults source='manual' — stamp the right
  // value so analytics can exclude debt-repayments from spending totals.
  await Expense.updateOne(
    { _id: expense.id },
    { $set: { source: 'debt-repayment' } }
  );

  const repayment = await DebtRepayment.create({
    user: oid(userId),
    debt: debt._id,
    amount,
    occurredAt: payload.occurredAt || new Date(),
    account: account || null,
    expense: expense.id,
    note: payload.note || '',
  });

  await _recompute(debt);

  return {
    repayment: toPublicRepayment(repayment),
    outstanding: debt.outstanding,
    status: debt.status,
    expenseId: expense.id,
  };
};

const listRepayments = async (userId, debtId, q = {}) => {
  const owns = await Debt.exists({ _id: debtId, user: oid(userId) });
  if (!owns) throw ApiError.notFound('Debt not found');

  const { page, limit, skip } = parsePagination(q);
  const filter = { debt: oid(debtId), deletedAt: null };
  const [items, total] = await Promise.all([
    DebtRepayment.find(filter).sort({ occurredAt: -1 }).skip(skip).limit(limit).lean(),
    DebtRepayment.countDocuments(filter),
  ]);
  return { items: items.map(toPublicRepayment), page, limit, total };
};

module.exports = {
  list,
  get,
  create,
  update,
  softDelete,
  recordRepayment,
  listRepayments,
};
