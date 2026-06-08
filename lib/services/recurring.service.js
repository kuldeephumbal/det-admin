const mongoose = require('mongoose');
const RecurringExpense = require('../models/RecurringExpense');
const Expense = require('../models/Expense');
const Category = require('../models/Category');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { NOTIFICATION_TYPES } = require('../config/constants');
const notifications = require('./notification.service');

const oid = (id) => new mongoose.Types.ObjectId(String(id));

// --- helpers ----------------------------------------------------------

const ensureCategoryAccessible = async (userId, categoryId) => {
  const cat = await Category.findOne({
    _id: categoryId,
    deletedAt: null,
    isActive: true,
    $or: [{ user: userId }, { isDefault: true, user: null }],
  }).lean();
  if (!cat) throw ApiError.badRequest('Invalid category');
  return cat;
};

const lastDayOfMonth = (year, monthZero) => new Date(Date.UTC(year, monthZero + 1, 0)).getUTCDate();

// Advance a UTC date by the given cadence. Month/year cadences clamp the
// dayOfMonth so 31-of-the-month rolls into shorter months gracefully.
const advance = (from, { frequency, interval = 1, dayOfMonth, weekday }) => {
  const d = new Date(from.getTime());
  switch (frequency) {
    case 'daily':
      d.setUTCDate(d.getUTCDate() + interval);
      return d;
    case 'weekly': {
      d.setUTCDate(d.getUTCDate() + interval * 7);
      if (weekday !== undefined && weekday !== null) {
        const wd = d.getUTCDay();
        const diff = (weekday - wd + 7) % 7;
        d.setUTCDate(d.getUTCDate() + diff);
      }
      return d;
    }
    case 'monthly': {
      d.setUTCDate(1);
      d.setUTCMonth(d.getUTCMonth() + interval);
      const desired = dayOfMonth || from.getUTCDate();
      const max = lastDayOfMonth(d.getUTCFullYear(), d.getUTCMonth());
      d.setUTCDate(Math.min(desired, max));
      return d;
    }
    case 'yearly': {
      d.setUTCFullYear(d.getUTCFullYear() + interval);
      if (dayOfMonth) {
        const max = lastDayOfMonth(d.getUTCFullYear(), d.getUTCMonth());
        d.setUTCDate(Math.min(dayOfMonth, max));
      }
      return d;
    }
    default:
      return d;
  }
};

const computeInitialNextRun = (cfg) => {
  const start = new Date(cfg.startDate);
  // If startDate is in the future, that IS the first run.
  if (start.getTime() >= Date.now()) return start;
  // Otherwise materializer advances from start until reaching the future.
  return start;
};

const toPublic = (doc) => ({
  id: String(doc._id),
  title: doc.title,
  amount: doc.amount,
  currency: doc.currency,
  category: doc.category && doc.category._id
    ? { id: String(doc.category._id), name: doc.category.name, icon: doc.category.icon, color: doc.category.color }
    : doc.category ? String(doc.category) : null,
  paymentMethod: doc.paymentMethod,
  note: doc.note || '',
  frequency: doc.frequency,
  interval: doc.interval,
  dayOfMonth: doc.dayOfMonth ?? null,
  weekday: doc.weekday ?? null,
  startDate: doc.startDate,
  endDate: doc.endDate ?? null,
  nextRunAt: doc.nextRunAt,
  lastRunAt: doc.lastRunAt ?? null,
  occurrenceCount: doc.occurrenceCount,
  maxOccurrences: doc.maxOccurrences ?? null,
  isActive: doc.isActive !== false,
  createdAt: doc.createdAt,
});

// --- CRUD --------------------------------------------------------------

const create = async (userId, payload) => {
  await ensureCategoryAccessible(userId, payload.category);
  const nextRunAt = computeInitialNextRun(payload);
  const doc = await RecurringExpense.create({
    ...payload,
    user: userId,
    nextRunAt,
  });
  await doc.populate({ path: 'category', select: 'name icon color' });
  return toPublic(doc);
};

const update = async (userId, id, patch) => {
  if (patch.category) await ensureCategoryAccessible(userId, patch.category);

  // If cadence-affecting fields change, recompute nextRunAt from the new startDate
  // (or keep the existing one if startDate didn't move).
  const doc = await RecurringExpense.findOneAndUpdate(
    { _id: id, user: userId, deletedAt: null },
    { $set: patch },
    { new: true, runValidators: true, context: 'query' }
  ).populate({ path: 'category', select: 'name icon color' });

  if (!doc) throw ApiError.notFound('Recurring expense not found');
  return toPublic(doc);
};

const softDelete = async (userId, id) => {
  const doc = await RecurringExpense.findOneAndUpdate(
    { _id: id, user: userId, deletedAt: null },
    { $set: { deletedAt: new Date(), isActive: false } }
  );
  if (!doc) throw ApiError.notFound('Recurring expense not found');
};

const list = async (userId, { activeOnly = true } = {}) => {
  const filter = { user: oid(userId), deletedAt: null };
  if (activeOnly) filter.isActive = true;
  const docs = await RecurringExpense.find(filter)
    .sort({ nextRunAt: 1 })
    .populate({ path: 'category', select: 'name icon color' })
    .lean();
  return docs.map(toPublic);
};

// --- Materializer ------------------------------------------------------
//
// Picks every active recurring whose nextRunAt has passed, inserts an Expense
// for each occurrence (catching up if the worker hasn't run for a while), and
// advances nextRunAt. Returns counters useful for logs.

const runDueNow = async ({ now = new Date(), maxPerRecurring = 50 } = {}) => {
  const dueDocs = await RecurringExpense.find({
    isActive: true,
    deletedAt: null,
    nextRunAt: { $lte: now },
  });

  let recurringProcessed = 0;
  let expensesCreated = 0;
  let recurringDeactivated = 0;

  for (const r of dueDocs) {
    let iterations = 0;
    try {
      while (
        r.isActive &&
        r.nextRunAt <= now &&
        iterations < maxPerRecurring
      ) {
        if (r.endDate && r.nextRunAt > r.endDate) {
          r.isActive = false;
          recurringDeactivated += 1;
          break;
        }
        if (r.maxOccurrences && r.occurrenceCount >= r.maxOccurrences) {
          r.isActive = false;
          recurringDeactivated += 1;
          break;
        }

        await Expense.create({
          user: r.user,
          amount: r.amount,
          currency: r.currency,
          category: r.category,
          date: r.nextRunAt,
          note: r.note || r.title,
          paymentMethod: r.paymentMethod,
          recurringSource: r._id,
        });
        expensesCreated += 1;

        // Inbox notification per occurrence — opted out via prefs in Phase 7 polish.
        await notifications.dispatch({
          user: r.user,
          type: NOTIFICATION_TYPES.RECURRING_REMINDER,
          title: `${r.title} was logged`,
          body: `${r.amount.toFixed(2)} ${r.currency} added from your recurring expense.`,
          data: { recurringId: String(r._id), amount: r.amount },
          deepLink: '/recurring',
        });

        r.lastRunAt = r.nextRunAt;
        r.occurrenceCount = (r.occurrenceCount || 0) + 1;
        r.nextRunAt = advance(r.nextRunAt, {
          frequency: r.frequency,
          interval: r.interval,
          dayOfMonth: r.dayOfMonth,
          weekday: r.weekday,
        });
        iterations += 1;
      }

      await r.save();
      recurringProcessed += 1;
    } catch (err) {
      logger.error('recurring.runDueNow: row failed', {
        recurringId: String(r._id),
        message: err.message,
      });
    }
  }

  return { recurringProcessed, expensesCreated, recurringDeactivated, at: now };
};

module.exports = { create, update, softDelete, list, runDueNow, advance };
