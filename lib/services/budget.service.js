const mongoose = require('mongoose');
const Budget = require('../models/Budget');
const Expense = require('../models/Expense');
const Category = require('../models/Category');
const ApiError = require('../utils/ApiError');
const { NOTIFICATION_TYPES } = require('../config/constants');
const notifications = require('./notification.service');
const logger = require('../utils/logger');

const oid = (id) => new mongoose.Types.ObjectId(String(id));

const currentMonthKey = () => {
  const d = new Date();
  return d.getUTCFullYear() * 100 + (d.getUTCMonth() + 1);
};

const monthKeyToRange = (monthKey) => {
  const year = Math.floor(monthKey / 100);
  const month = (monthKey % 100) - 1;
  const from = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const to = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));
  return { from, to };
};

const yearToRange = (year) => ({
  from: new Date(Date.UTC(year, 0, 1)),
  to: new Date(Date.UTC(year + 1, 0, 1)),
});

const toPublic = (b, extras = {}) => ({
  id: String(b._id),
  category: b.category ? String(b.category) : null,
  period: b.period,
  month: b.month ?? null,
  year: b.year,
  amount: b.amount,
  currency: b.currency,
  alertThreshold: b.alertThreshold,
  rolloverUnused: !!b.rolloverUnused,
  isActive: b.isActive !== false,
  createdAt: b.createdAt,
  updatedAt: b.updatedAt,
  ...extras,
});

const ensureCategoryAccessible = async (userId, categoryId) => {
  if (!categoryId) return null;
  const cat = await Category.findOne({
    _id: categoryId,
    deletedAt: null,
    $or: [{ user: userId }, { isDefault: true, user: null }],
  }).lean();
  if (!cat) throw ApiError.badRequest('Invalid category');
  return cat;
};

const create = async (userId, payload) => {
  await ensureCategoryAccessible(userId, payload.category);
  const doc = await Budget.create({
    ...payload,
    user: userId,
    category: payload.category || null,
  });
  return toPublic(doc);
};

const update = async (userId, id, patch) => {
  const doc = await Budget.findOneAndUpdate(
    { _id: id, user: userId, deletedAt: null },
    { $set: patch },
    { new: true, runValidators: true, context: 'query' }
  );
  if (!doc) throw ApiError.notFound('Budget not found');
  return toPublic(doc);
};

const softDelete = async (userId, id) => {
  const doc = await Budget.findOneAndUpdate(
    { _id: id, user: userId, deletedAt: null },
    { $set: { deletedAt: new Date() } },
    { new: false }
  );
  if (!doc) throw ApiError.notFound('Budget not found');
};

const list = async (userId, q = {}) => {
  const filter = { user: oid(userId), deletedAt: null };
  if (q.period) filter.period = q.period;
  if (q.year) filter.year = q.year;
  if (q.month) filter.month = q.month;
  if (q.activeOnly) filter.isActive = true;

  const docs = await Budget.find(filter)
    .sort({ year: -1, month: -1, category: 1 })
    .lean();
  return docs.map(toPublic);
};

// Computes used / remaining / pct for each active budget in the given period.
const status = async (userId, { month, year } = {}) => {
  const targetMonth = month || currentMonthKey();
  const targetYear = year || Math.floor(targetMonth / 100);
  const userObj = oid(userId);

  const budgets = await Budget.find({
    user: userObj,
    deletedAt: null,
    isActive: true,
    $or: [
      { period: 'monthly', month: targetMonth },
      { period: 'yearly', year: targetYear },
    ],
  })
    .populate({ path: 'category', select: 'name icon color' })
    .lean();

  if (budgets.length === 0) return { month: targetMonth, year: targetYear, items: [] };

  const items = [];
  for (const b of budgets) {
    const { from, to } =
      b.period === 'monthly' ? monthKeyToRange(b.month) : yearToRange(b.year);

    const match = {
      user: userObj,
      deletedAt: null,
      date: { $gte: from, $lt: to },
    };
    if (b.category) match.category = b.category._id;

    const [agg] = await Expense.aggregate([
      { $match: match },
      { $group: { _id: null, used: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);

    const used = agg?.used || 0;
    const remaining = Math.max(0, b.amount - used);
    const usedPct = b.amount > 0 ? Math.min(999, (used / b.amount) * 100) : 0;
    const stateFlag =
      usedPct >= 100 ? 'over' : usedPct >= (b.alertThreshold || 80) ? 'warning' : 'ok';

    items.push({
      id: String(b._id),
      category: b.category
        ? {
            id: String(b.category._id),
            name: b.category.name,
            icon: b.category.icon,
            color: b.category.color,
          }
        : null,
      period: b.period,
      month: b.month ?? null,
      year: b.year,
      amount: b.amount,
      currency: b.currency,
      alertThreshold: b.alertThreshold,
      used,
      remaining,
      usedPct: Math.round(usedPct * 100) / 100,
      transactions: agg?.count || 0,
      state: stateFlag,
    });
  }

  return { month: targetMonth, year: targetYear, items };
};

// Called after an expense is created. Walks the user's active budgets for the
// affected period, and creates a Notification once per budget when usage
// first crosses the configured threshold.
const checkAndAlert = async (userId, expense) => {
  try {
    const expenseDate = new Date(expense.date);
    const monthKey = expenseDate.getUTCFullYear() * 100 + (expenseDate.getUTCMonth() + 1);
    const year = expenseDate.getUTCFullYear();

    const budgets = await Budget.find({
      user: oid(userId),
      deletedAt: null,
      isActive: true,
      alertSentAt: null,
      $or: [
        { period: 'monthly', month: monthKey },
        { period: 'yearly', year },
      ],
      $and: [
        {
          $or: [
            { category: null },
            { category: expense.category?._id || expense.category },
          ],
        },
      ],
    }).populate({ path: 'category', select: 'name' });

    for (const b of budgets) {
      const { from, to } =
        b.period === 'monthly' ? monthKeyToRange(b.month) : yearToRange(b.year);

      const match = { user: oid(userId), deletedAt: null, date: { $gte: from, $lt: to } };
      if (b.category) match.category = b.category._id;

      const [agg] = await Expense.aggregate([
        { $match: match },
        { $group: { _id: null, used: { $sum: '$amount' } } },
      ]);
      const used = agg?.used || 0;
      const pct = b.amount > 0 ? (used / b.amount) * 100 : 0;

      if (pct < b.alertThreshold) continue;

      const isOver = pct >= 100;
      const scope = b.category ? b.category.name : 'overall';
      const periodLabel = b.period === 'monthly' ? 'this month' : 'this year';

      await notifications.dispatch({
        user: userId,
        type: NOTIFICATION_TYPES.BUDGET_ALERT,
        title: isOver
          ? `Over your ${scope} budget`
          : `${Math.round(pct)}% of your ${scope} budget`,
        body: isOver
          ? `You've spent ${used.toFixed(2)} of ${b.amount.toFixed(2)} ${periodLabel}.`
          : `You've used ${pct.toFixed(0)}% of your ${scope} budget ${periodLabel}.`,
        data: {
          budgetId: String(b._id),
          scope,
          usedAmount: used,
          budgetAmount: b.amount,
          pct: Math.round(pct * 100) / 100,
        },
        deepLink: `/budgets/${String(b._id)}`,
      });

      b.alertSentAt = new Date();
      await b.save();
    }
  } catch (err) {
    // Threshold alerting must never break expense creation.
    logger.error('budget.checkAndAlert failed', { message: err.message });
  }
};

// ---------- Smart Suggestions (Feature 9) ----------
//
// Premium-gated upstream at the route layer. Pure aggregation —
// `suggestForCategory` computes a monthly target from the last 3
// months of spending in the category. We use median + 10% buffer
// because the mean blows up on one-off purchases (₹15k phone in
// the "Shopping" category, say).

const MIN_MONTHS_FOR_SUGGESTION = 2;
const SUGGESTION_LOOKBACK_MONTHS = 3;

const _monthlyTotalsForCategory = async (userId, categoryId, months) => {
  const since = new Date();
  since.setUTCDate(1);
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCMonth(since.getUTCMonth() - months);

  const match = { user: oid(userId), deletedAt: null, date: { $gte: since } };
  if (categoryId) match.category = oid(categoryId);

  const rows = await Expense.aggregate([
    { $match: match },
    {
      $group: {
        _id: { y: { $year: '$date' }, m: { $month: '$date' } },
        total: { $sum: '$amount' },
      },
    },
    { $sort: { '_id.y': 1, '_id.m': 1 } },
  ]);
  return rows.map((r) => r.total);
};

const _median = (sorted) => {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
};

const suggestForCategory = async (userId, { category, period = 'monthly' } = {}) => {
  await ensureCategoryAccessible(userId, category);

  const totals = await _monthlyTotalsForCategory(userId, category, SUGGESTION_LOOKBACK_MONTHS);
  if (totals.length < MIN_MONTHS_FOR_SUGGESTION) {
    return {
      category: category ? String(category) : null,
      period,
      suggestion: null,
      basis: 'insufficient-data',
      months: totals.length,
      monthlyTotals: totals,
    };
  }

  const sorted = [...totals].sort((a, b) => a - b);
  const median = _median(sorted);
  const buffered = median * 1.1;
  // Round up to nearest ₹10 for a clean UI number.
  const rounded = Math.ceil(buffered / 10) * 10;

  return {
    category: category ? String(category) : null,
    period,
    suggestion: rounded,
    basis: 'median-plus-10pct',
    months: totals.length,
    monthlyTotals: totals,
    rawMedian: Math.round(median * 100) / 100,
  };
};

// Categories where the user has spent in the last lookback window but
// has no active budget — surfaced on the home banner ("you spend ₹X on
// Food but have no budget").
const missingBudgets = async (userId) => {
  const userObj = oid(userId);

  // 1. Active monthly budgets for the current month (we don't suggest
  //    against a yearly budget — those cover the category already).
  const monthKey = currentMonthKey();
  const activeBudgets = await Budget.find({
    user: userObj,
    deletedAt: null,
    isActive: true,
    $or: [
      { period: 'monthly', month: monthKey },
      { period: 'yearly', year: Math.floor(monthKey / 100) },
    ],
  }).select('category').lean();

  const covered = new Set(
    activeBudgets.filter((b) => b.category).map((b) => String(b.category))
  );
  const hasOverall = activeBudgets.some((b) => !b.category);

  // 2. Categories the user has spent in over the lookback window.
  const since = new Date();
  since.setUTCDate(1);
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCMonth(since.getUTCMonth() - SUGGESTION_LOOKBACK_MONTHS);

  const spentBy = await Expense.aggregate([
    { $match: { user: userObj, deletedAt: null, date: { $gte: since }, category: { $ne: null } } },
    {
      $group: {
        _id: '$category',
        total: { $sum: '$amount' },
        count: { $sum: 1 },
        monthsActive: {
          $addToSet: {
            $dateToString: { date: '$date', format: '%Y-%m' },
          },
        },
      },
    },
    {
      $lookup: {
        from: 'categories',
        localField: '_id',
        foreignField: '_id',
        as: 'category',
      },
    },
    { $unwind: { path: '$category', preserveNullAndEmptyArrays: false } },
    {
      $project: {
        _id: 0,
        category: {
          id: { $toString: '$category._id' },
          name: '$category.name',
          icon: '$category.icon',
          color: '$category.color',
        },
        totalSpent: '$total',
        transactionCount: '$count',
        monthsActive: { $size: '$monthsActive' },
      },
    },
    { $sort: { totalSpent: -1 } },
  ]);

  const missing = spentBy
    // Need consistent spending (at least 2 of the last 3 months) to
    // recommend setting a budget — random one-offs shouldn't trigger.
    .filter((row) => row.monthsActive >= MIN_MONTHS_FOR_SUGGESTION)
    .filter((row) => !covered.has(row.category.id))
    .map((row) => ({
      category: row.category,
      monthlyAverage: Math.round((row.totalSpent / row.monthsActive) * 100) / 100,
      transactionCount: row.transactionCount,
    }));

  return {
    monthsAnalyzed: SUGGESTION_LOOKBACK_MONTHS,
    hasOverallBudget: hasOverall,
    missing,
  };
};

module.exports = {
  create,
  update,
  softDelete,
  list,
  status,
  checkAndAlert,
  suggestForCategory,
  missingBudgets,
};
