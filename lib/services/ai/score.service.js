// Financial Health Score (Feature 10).
//
// Pure deterministic — no LLM call. Lives under `ai/` per the folder
// map in plan §11 because Phase 3 Insights consume these inputs.
//
// Five 0–100 factor scores combined into a single 0–100 number with
// the weighting below. Tweak weights cautiously: scores are visible
// to users and changing weights mid-flight makes the trend chart
// look noisy.

const mongoose = require('mongoose');
const Expense = require('../../models/Expense');
const Budget = require('../../models/Budget');
const RecurringExpense = require('../../models/RecurringExpense');
const { SavingsGoal } = require('../../models/SavingsGoal');
const { GoalContribution } = require('../../models/GoalContribution');
const FinancialScoreSnapshot = require('../../models/FinancialScoreSnapshot');
const ApiError = require('../../utils/ApiError');
const logger = require('../../utils/logger');

const oid = (id) => new mongoose.Types.ObjectId(String(id));

const WEIGHTS = {
  budgetAdherence: 0.30,
  savingsRate: 0.20,
  recurringDiscretionaryRatio: 0.15,
  expenseDiversification: 0.15,
  goalProgress: 0.20,
};

// Cap: don't score users with insufficient data. Below this threshold,
// status() returns null and the mobile UI shows a "keep tracking for
// a few more days" empty state.
const MIN_EXPENSES_FOR_SCORE = 30;

const _periodRange = (year, month) => {
  const from = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const to = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  return { from, to };
};

// Bounded linear scoring — clamp into [0,100] so a single outlier
// can't push the composite past the cap.
const clamp = (n) => Math.max(0, Math.min(100, n));

// ---------- Factor calculators ----------
//
// Each returns a 0..100 number. Higher = healthier.

const _budgetAdherence = async (userId, { from, to }) => {
  const userObj = oid(userId);
  const budgets = await Budget.find({
    user: userObj,
    deletedAt: null,
    isActive: true,
    $or: [{ period: 'yearly', year: from.getUTCFullYear() }, {
      period: 'monthly',
      month: from.getUTCFullYear() * 100 + (from.getUTCMonth() + 1),
    }],
  }).lean();

  if (budgets.length === 0) {
    // No budget = no signal. Neutral 50, not 0 (don't punish users
    // who haven't engaged with budgets yet — the missing-budget banner
    // from Feature 9 already nudges them).
    return { score: 50, totalSpent: 0, totalBudgeted: 0 };
  }

  let totalSpent = 0;
  let totalBudgeted = 0;
  for (const b of budgets) {
    totalBudgeted += b.amount;
    const match = { user: userObj, deletedAt: null, date: { $gte: from, $lt: to } };
    if (b.category) match.category = b.category;
    const [agg] = await Expense.aggregate([
      { $match: match },
      { $group: { _id: null, used: { $sum: '$amount' } } },
    ]);
    totalSpent += agg?.used || 0;
  }

  if (totalBudgeted === 0) return { score: 50, totalSpent, totalBudgeted };
  // 100% spent = score 100 (right on budget). Penalty grows
  // quadratically past the line — small overruns nudge it down,
  // big overruns crush it.
  const ratio = totalSpent / totalBudgeted;
  if (ratio <= 1) return { score: clamp(80 + (1 - Math.abs(ratio - 0.9)) * 20), totalSpent, totalBudgeted };
  const overshoot = ratio - 1;
  const score = clamp(80 - overshoot * 200); // 50% over → score 0
  return { score, totalSpent, totalBudgeted };
};

const _savingsRate = async (userId, { from, to }) => {
  const userObj = oid(userId);
  const [{ contribs = 0 } = {}] = await GoalContribution.aggregate([
    {
      $match: {
        user: userObj,
        deletedAt: null,
        occurredAt: { $gte: from, $lt: to },
        amount: { $gt: 0 },
      },
    },
    { $group: { _id: null, contribs: { $sum: '$amount' } } },
    { $project: { _id: 0, contribs: 1 } },
  ]);

  const [{ spent = 0 } = {}] = await Expense.aggregate([
    { $match: { user: userObj, deletedAt: null, date: { $gte: from, $lt: to } } },
    { $group: { _id: null, spent: { $sum: '$amount' } } },
    { $project: { _id: 0, spent: 1 } },
  ]);

  const denominator = contribs + spent;
  if (denominator === 0) return { score: 50, contribs, spent };

  // 20% savings rate = score 100 (US personal-finance baseline).
  // Linear from 0% → 0 to 20% → 100, capped at 100 beyond.
  const rate = contribs / denominator;
  const score = clamp((rate / 0.20) * 100);
  return { score, contribs, spent };
};

const _recurringDiscretionaryRatio = async (userId, { from, to }) => {
  const userObj = oid(userId);
  const [{ recurring = 0, total = 0 } = {}] = await Expense.aggregate([
    { $match: { user: userObj, deletedAt: null, date: { $gte: from, $lt: to } } },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' },
        recurring: {
          $sum: { $cond: [{ $ne: ['$recurringSource', null] }, '$amount', 0] },
        },
      },
    },
    { $project: { _id: 0, recurring: 1, total: 1 } },
  ]);

  if (total === 0) return { score: 50, recurring, total };
  // 50% recurring = ideal (50% room for discretionary). Score peaks
  // there; off-peak in either direction linearly.
  const ratio = recurring / total;
  const distFromIdeal = Math.abs(ratio - 0.5);
  const score = clamp(100 - distFromIdeal * 200);
  return { score, recurring, total };
};

const _expenseDiversification = async (userId, { from, to }) => {
  const userObj = oid(userId);
  const rows = await Expense.aggregate([
    {
      $match: {
        user: userObj,
        deletedAt: null,
        date: { $gte: from, $lt: to },
        category: { $ne: null },
      },
    },
    { $group: { _id: '$category', amount: { $sum: '$amount' } } },
  ]);

  if (rows.length === 0) return { score: 50, categoriesActive: 0 };

  // Shannon entropy of category spend distribution, normalized to
  // log(N). Higher entropy = better spread = healthier.
  const total = rows.reduce((s, r) => s + r.amount, 0) || 1;
  const entropy = rows.reduce((s, r) => {
    const p = r.amount / total;
    return s - (p > 0 ? p * Math.log(p) : 0);
  }, 0);
  const maxEntropy = Math.log(Math.max(rows.length, 2));
  const norm = maxEntropy > 0 ? entropy / maxEntropy : 0;
  return { score: clamp(norm * 100), categoriesActive: rows.length };
};

const _goalProgress = async (userId, { from, to }) => {
  const userObj = oid(userId);
  const goals = await SavingsGoal.find({
    user: userObj,
    deletedAt: null,
    status: 'active',
    deadline: { $gte: from },
  }).select('targetAmount currentAmount').lean();

  if (goals.length === 0) return { score: 50, goalsActive: 0, goalProgressRatioAvg: 0 };

  const ratios = goals.map((g) =>
    g.targetAmount > 0 ? Math.min(1, (g.currentAmount || 0) / g.targetAmount) : 0
  );
  const avg = ratios.reduce((s, r) => s + r, 0) / ratios.length;
  return { score: clamp(avg * 100), goalsActive: goals.length, goalProgressRatioAvg: avg };
};

// ---------- Compose ----------

const computeForPeriod = async (userId, year, month) => {
  const { from, to } = _periodRange(year, month);

  // Bail early if there isn't enough activity to score against.
  const expenseCount = await Expense.countDocuments({
    user: oid(userId),
    deletedAt: null,
    date: { $gte: from, $lt: to },
  });
  if (expenseCount < MIN_EXPENSES_FOR_SCORE) {
    return null;
  }

  const [adh, sav, rec, div, goal] = await Promise.all([
    _budgetAdherence(userId, { from, to }),
    _savingsRate(userId, { from, to }),
    _recurringDiscretionaryRatio(userId, { from, to }),
    _expenseDiversification(userId, { from, to }),
    _goalProgress(userId, { from, to }),
  ]);

  const composite =
    adh.score * WEIGHTS.budgetAdherence +
    sav.score * WEIGHTS.savingsRate +
    rec.score * WEIGHTS.recurringDiscretionaryRatio +
    div.score * WEIGHTS.expenseDiversification +
    goal.score * WEIGHTS.goalProgress;

  const snapshot = {
    score: Math.round(composite),
    factors: {
      budgetAdherence: Math.round(adh.score),
      savingsRate: Math.round(sav.score),
      recurringDiscretionaryRatio: Math.round(rec.score),
      expenseDiversification: Math.round(div.score),
      goalProgress: Math.round(goal.score),
    },
    inputs: {
      totalSpent: adh.totalSpent || sav.spent || 0,
      totalBudgeted: adh.totalBudgeted || 0,
      recurringSpent: rec.recurring || 0,
      categoriesActive: div.categoriesActive || 0,
      goalsActive: goal.goalsActive || 0,
      goalProgressRatioAvg: Math.round((goal.goalProgressRatioAvg || 0) * 1000) / 1000,
    },
  };

  return snapshot;
};

const _persist = async (userId, year, month, snapshot) => {
  const doc = await FinancialScoreSnapshot.findOneAndUpdate(
    { user: oid(userId), 'period.year': year, 'period.month': month },
    {
      $set: {
        user: oid(userId),
        period: { year, month },
        ...snapshot,
        computedAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return doc;
};

// ---------- Public API ----------

const _currentPeriod = () => {
  const d = new Date();
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
};

const _previousPeriod = ({ year, month }) => {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
};

const toPublic = (snap) =>
  snap && {
    period: { year: snap.period.year, month: snap.period.month },
    score: snap.score,
    factors: snap.factors,
    inputs: snap.inputs,
    computedAt: snap.computedAt,
  };

const getCurrent = async (userId) => {
  const { year, month } = _currentPeriod();
  const existing = await FinancialScoreSnapshot.findOne({
    user: oid(userId),
    'period.year': year,
    'period.month': month,
  }).lean();
  if (existing) {
    const prev = await FinancialScoreSnapshot.findOne({
      user: oid(userId),
      'period.year': _previousPeriod({ year, month }).year,
      'period.month': _previousPeriod({ year, month }).month,
    }).lean();
    return { ...toPublic(existing), previousScore: prev?.score ?? null };
  }
  // No cached snapshot yet — compute on the fly. Subsequent calls
  // get the cached version until the monthly cron recomputes.
  const computed = await computeForPeriod(userId, year, month);
  if (!computed) {
    return { period: { year, month }, score: null, factors: null, reason: 'insufficient-data' };
  }
  const persisted = await _persist(userId, year, month, computed);
  return toPublic(persisted);
};

const getHistory = async (userId, { limit = 12 } = {}) => {
  const rows = await FinancialScoreSnapshot.find({ user: oid(userId) })
    .sort({ 'period.year': -1, 'period.month': -1 })
    .limit(limit)
    .lean();
  return { items: rows.map(toPublic) };
};

const recompute = async (userId) => {
  const { year, month } = _currentPeriod();
  const snapshot = await computeForPeriod(userId, year, month);
  if (!snapshot) {
    throw ApiError.badRequest('Not enough activity this month to compute a score yet');
  }
  const persisted = await _persist(userId, year, month, snapshot);
  return toPublic(persisted);
};

// ---------- Cron (monthly, 1st of month for previous month) ----------

const runMonthlyRecompute = async ({ now = new Date(), shard = null, shardCount = 1 } = {}) => {
  // Recompute for the *previous* calendar month — that month is now
  // closed, so this is the canonical snapshot.
  const prevMonth = now.getUTCMonth() === 0 ? 12 : now.getUTCMonth();
  const prevYear = now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();

  // Find all users who logged at least MIN_EXPENSES_FOR_SCORE expenses
  // last month — anyone else won't get a score, so don't bother
  // iterating them.
  const { from, to } = _periodRange(prevYear, prevMonth);
  const activeUsers = await Expense.aggregate([
    { $match: { deletedAt: null, date: { $gte: from, $lt: to } } },
    { $group: { _id: '$user', count: { $sum: 1 } } },
    { $match: { count: { $gte: MIN_EXPENSES_FOR_SCORE } } },
    { $project: { _id: 1 } },
  ]);

  let computed = 0;
  let skipped = 0;
  for (const row of activeUsers) {
    const idStr = String(row._id);
    if (shardCount > 1) {
      // Cheap sharding so multiple cron invocations can split the
      // user space — last byte of the ObjectId mod shardCount.
      const tag = parseInt(idStr.slice(-2), 16);
      if (tag % shardCount !== shard) continue;
    }
    try {
      const snapshot = await computeForPeriod(idStr, prevYear, prevMonth);
      if (snapshot) {
        await _persist(idStr, prevYear, prevMonth, snapshot);
        computed += 1;
      } else {
        skipped += 1;
      }
    } catch (err) {
      logger.warn('financial-score recompute row failed', {
        userId: idStr,
        message: err.message,
      });
    }
  }

  return { computed, skipped, period: { year: prevYear, month: prevMonth } };
};

module.exports = {
  getCurrent,
  getHistory,
  recompute,
  computeForPeriod,
  runMonthlyRecompute,
  WEIGHTS,
  MIN_EXPENSES_FOR_SCORE,
};
