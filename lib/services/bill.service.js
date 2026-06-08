// Bills & Planned Payments service (Feature 14).
//
// A Bill is a *future obligation* — distinct from RecurringExpense
// (which auto-materialises an Expense on schedule). The user marks the
// bill paid when they actually pay it; at that point we:
//   1. Mint an Expense linked to the chosen account.
//   2. Stamp `paidAt` + `paidExpense` on the Bill.
//   3. If recurring, create the next instance with dueDate advanced.
//
// Reminder cron is in this file too: walks every unpaid bill in the
// reminder window and dispatches push notifications, marking the
// already-fired windows on the row so we never double-send.

const mongoose = require('mongoose');
const Bill = require('../models/Bill');
const Expense = require('../models/Expense');
const Category = require('../models/Category');
const Account = require('../models/Account');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { parsePagination } = require('../utils/pagination');
const {
  NOTIFICATION_TYPES,
  BILL_REMINDER_DAYS_AHEAD,
} = require('../config/constants');
const notifications = require('./notification.service');

const oid = (id) => new mongoose.Types.ObjectId(String(id));

const toPublic = (doc) => {
  const o = typeof doc.toObject === 'function' ? doc.toObject({ virtuals: true }) : doc;
  return {
    id: String(o._id),
    name: o.name,
    amount: o.amount,
    currency: o.currency,
    account: o.account ? String(o.account) : null,
    category: o.category ? String(o.category) : null,
    dueDate: o.dueDate,
    recurrence: o.recurrence,
    autoPay: !!o.autoPay,
    notes: o.notes || '',
    paidAt: o.paidAt || null,
    paidAmount: o.paidAmount || null,
    paidExpense: o.paidExpense ? String(o.paidExpense) : null,
    nextInstance: o.nextInstance ? String(o.nextInstance) : null,
    previousInstance: o.previousInstance ? String(o.previousInstance) : null,
    state: _stateFor(o),
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
};

const _stateFor = (b) => {
  if (b.paidAt) return 'paid';
  const due = b.dueDate instanceof Date ? b.dueDate : new Date(b.dueDate);
  return due.getTime() <= Date.now() ? 'overdue' : 'upcoming';
};

// Advance a date by the bill's recurrence cadence. Handles month-end
// edge cases gracefully (Jan 31 + monthly → Feb 28/29, not Mar 3).
const _advance = (from, recurrence) => {
  const d = new Date(from.getTime());
  switch (recurrence) {
    case 'weekly':
      d.setUTCDate(d.getUTCDate() + 7);
      return d;
    case 'monthly': {
      const desired = d.getUTCDate();
      d.setUTCDate(1);
      d.setUTCMonth(d.getUTCMonth() + 1);
      const max = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
      d.setUTCDate(Math.min(desired, max));
      return d;
    }
    case 'quarterly': {
      const desired = d.getUTCDate();
      d.setUTCDate(1);
      d.setUTCMonth(d.getUTCMonth() + 3);
      const max = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
      d.setUTCDate(Math.min(desired, max));
      return d;
    }
    case 'yearly': {
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      return d;
    }
    case 'none':
    default:
      return d;
  }
};

// ---------- Filters ----------

const _buildFilter = (userId, q = {}) => {
  const filter = { user: oid(userId), deletedAt: null };
  const now = new Date();
  if (q.state === 'upcoming') {
    filter.paidAt = null;
    filter.dueDate = { $gt: now };
  } else if (q.state === 'overdue') {
    filter.paidAt = null;
    filter.dueDate = { $lte: now };
  } else if (q.state === 'paid') {
    filter.paidAt = { $ne: null };
  }
  if (q.daysAhead) {
    const cutoff = new Date(now.getTime() + q.daysAhead * 86400_000);
    filter.dueDate = { ...(filter.dueDate || {}), $lte: cutoff };
  }
  return filter;
};

// ---------- CRUD ----------

const list = async (userId, q = {}) => {
  const { page, limit, skip } = parsePagination(q);
  const filter = _buildFilter(userId, q);

  // Sort: unpaid first (by closest due), then paid (most recent first).
  const sort = filter.paidAt && filter.paidAt.$ne !== undefined
    ? { paidAt: -1 }
    : { dueDate: 1 };

  const [items, total] = await Promise.all([
    Bill.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Bill.countDocuments(filter),
  ]);

  return {
    items: items.map(toPublic),
    page,
    limit,
    total,
  };
};

const get = async (userId, id) => {
  const doc = await Bill.findOne({
    _id: id,
    user: oid(userId),
    deletedAt: null,
  }).lean();
  if (!doc) throw ApiError.notFound('Bill not found');
  return toPublic(doc);
};

const _ensureAccountAccessible = async (userId, accountId) => {
  if (!accountId) return;
  const account = await Account.findOne({
    _id: accountId,
    user: oid(userId),
    deletedAt: null,
  }).lean();
  if (!account) throw ApiError.badRequest('Invalid account');
};

const _ensureCategoryAccessible = async (userId, categoryId) => {
  if (!categoryId) return;
  const cat = await Category.findOne({
    _id: categoryId,
    deletedAt: null,
    $or: [{ user: userId }, { isDefault: true, user: null }],
  }).lean();
  if (!cat) throw ApiError.badRequest('Invalid category');
};

const create = async (userId, payload) => {
  await _ensureAccountAccessible(userId, payload.account);
  await _ensureCategoryAccessible(userId, payload.category);

  const doc = await Bill.create({
    ...payload,
    user: oid(userId),
  });
  return toPublic(doc);
};

const update = async (userId, id, patch) => {
  if (patch.account) await _ensureAccountAccessible(userId, patch.account);
  if (patch.category) await _ensureCategoryAccessible(userId, patch.category);

  // Reject edits to a bill that's already been paid — its accounting
  // record (paidExpense) is the source of truth; changing the Bill row
  // would desync them silently.
  const existing = await Bill.findOne({
    _id: id,
    user: oid(userId),
    deletedAt: null,
  });
  if (!existing) throw ApiError.notFound('Bill not found');
  if (existing.paidAt) {
    throw ApiError.badRequest(
      'This bill is already paid — edit the linked expense instead'
    );
  }

  Object.assign(existing, patch);
  // Editing the dueDate resets the reminder bookkeeping so the new
  // schedule re-fires from scratch.
  if (patch.dueDate) existing.remindersFired = [];
  await existing.save();
  return toPublic(existing);
};

const softDelete = async (userId, id) => {
  const doc = await Bill.findOneAndUpdate(
    { _id: id, user: oid(userId), deletedAt: null },
    { $set: { deletedAt: new Date() } }
  );
  if (!doc) throw ApiError.notFound('Bill not found');
};

// ---------- Pay flow ----------
//
// 1. Validates the bill is unpaid and the account / category are accessible.
// 2. Creates an Expense for the actual paid amount (defaults to the bill's
//    expected amount) under the user's chosen account.
// 3. Stamps paidAt + paidAmount + paidExpense on the bill.
// 4. If recurrence != 'none', creates the next instance (dueDate
//    advanced) and chains it via nextInstance / previousInstance.
// 5. Fires a confirmation push.

const pay = async (userId, id, payload = {}) => {
  const bill = await Bill.findOne({
    _id: id,
    user: oid(userId),
    deletedAt: null,
  });
  if (!bill) throw ApiError.notFound('Bill not found');
  if (bill.paidAt) {
    throw ApiError.conflict('Bill is already marked paid', {
      field: 'paidAt',
      value: bill.paidAt,
    });
  }

  const amount = payload.amount || bill.amount;
  const account = payload.account || bill.account;
  const category = payload.category || bill.category;
  await _ensureAccountAccessible(userId, account);
  await _ensureCategoryAccessible(userId, category);

  // Category is required on Expense, so if the user didn't pick one and
  // the bill doesn't carry one either, fall back to any category they
  // have access to.
  let resolvedCategory = category;
  if (!resolvedCategory) {
    const anyCat = await Category.findOne({
      $or: [{ user: oid(userId) }, { isDefault: true, user: null }],
      deletedAt: null,
      isActive: true,
    }).select('_id').lean();
    if (!anyCat) {
      throw ApiError.badRequest(
        'No category to attribute the payment to — set up at least one category first'
      );
    }
    resolvedCategory = anyCat._id;
  }

  // 1) Mint the Expense via the expense service so its own side-effects
  //    (budget alerts, account-balance recompute) run.
  const expenseService = require('./expense.service');
  const expense = await expenseService.create(userId, {
    amount,
    currency: bill.currency,
    category: resolvedCategory,
    account,
    date: payload.paidAt || new Date(),
    note: payload.note || bill.name,
    paymentMethod: 'card',
  });

  // 2) Stamp the bill.
  bill.paidAt = payload.paidAt || new Date();
  bill.paidAmount = amount;
  bill.paidExpense = oid(expense.id);

  // 3) If recurring, chain the next instance.
  let nextInstance = null;
  if (bill.recurrence && bill.recurrence !== 'none') {
    nextInstance = await Bill.create({
      user: bill.user,
      name: bill.name,
      amount: bill.amount,
      currency: bill.currency,
      account: bill.account,
      category: bill.category,
      dueDate: _advance(bill.dueDate, bill.recurrence),
      recurrence: bill.recurrence,
      autoPay: bill.autoPay,
      notes: bill.notes,
      previousInstance: bill._id,
    });
    bill.nextInstance = nextInstance._id;
  }
  await bill.save();

  // 4) Confirmation push — fire-and-forget so a flaky FCM doesn't fail
  //    the pay action.
  notifications
    .dispatch({
      user: bill.user,
      type: NOTIFICATION_TYPES.BILL_PAID,
      title: `${bill.name} paid`,
      body: `Recorded as ${amount.toFixed(2)} ${bill.currency}.`,
      data: { billId: String(bill._id), expenseId: expense.id },
      deepLink: `/bills/${String(bill._id)}`,
    })
    .catch(() => {});

  return {
    bill: toPublic(bill),
    expenseId: expense.id,
    nextInstance: nextInstance ? toPublic(nextInstance) : null,
  };
};

// ---------- Cron ----------
//
// Daily reminder job — walks every unpaid bill whose dueDate falls
// inside the longest reminder window and fires push notifications for
// any T-N marker we haven't already covered.

const runDailyReminders = async (now = new Date()) => {
  if (BILL_REMINDER_DAYS_AHEAD.length === 0) return { sent: 0, overdue: 0 };

  const maxDays = Math.max(...BILL_REMINDER_DAYS_AHEAD);
  const windowEnd = new Date(now.getTime() + (maxDays + 1) * 86400_000);

  const cursor = Bill.find({
    paidAt: null,
    deletedAt: null,
    dueDate: { $lte: windowEnd },
  }).cursor();

  let sent = 0;
  let overdue = 0;
  for await (const bill of cursor) {
    try {
      const daysAhead = Math.ceil(
        (bill.dueDate.getTime() - now.getTime()) / 86400_000
      );

      // Pick the smallest unfired window that we've reached.
      // E.g. on day-of, daysAhead is 0; we fire `0` if `0` not in
      // remindersFired. On day before, daysAhead is 1; we fire `1`,
      // etc.
      const candidate = BILL_REMINDER_DAYS_AHEAD
        .slice()
        .sort((a, b) => a - b)
        .find((d) => d >= daysAhead && !bill.remindersFired.includes(d));

      if (candidate === undefined) continue;

      const isOverdue = daysAhead < 0;
      const title = isOverdue
        ? `${bill.name} is overdue`
        : daysAhead === 0
        ? `${bill.name} is due today`
        : `${bill.name} due in ${daysAhead} day${daysAhead === 1 ? '' : 's'}`;
      const body = `${bill.amount.toFixed(2)} ${bill.currency} — tap to mark paid.`;

      await notifications
        .dispatch({
          user: bill.user,
          type: isOverdue
            ? NOTIFICATION_TYPES.BILL_OVERDUE
            : NOTIFICATION_TYPES.BILL_DUE,
          title,
          body,
          data: { billId: String(bill._id), dueDate: bill.dueDate, amount: bill.amount },
          deepLink: `/bills/${String(bill._id)}`,
        })
        .catch((err) =>
          logger.warn('bill reminder dispatch failed', { message: err.message })
        );

      bill.remindersFired = [...new Set([...bill.remindersFired, candidate])];
      bill.lastReminderSentAt = now;
      await bill.save();
      sent += 1;
      if (isOverdue) overdue += 1;
    } catch (err) {
      logger.error('bill reminder row failed', {
        billId: String(bill._id),
        message: err.message,
      });
    }
  }
  return { sent, overdue };
};

module.exports = {
  list,
  get,
  create,
  update,
  softDelete,
  pay,
  runDailyReminders,
  _advance, // for tests
};
