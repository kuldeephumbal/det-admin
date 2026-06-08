// Savings Goals service.
//
// Phase 2 Feature 5: goals + contributions + auto-contribution cron.
//
// Free-tier cap: 1 active goal (enforced in create()). Premium users
// (User.plan === 'premium') have no cap — gate enforced before the
// service is called (route uses requirePlan only on the premium-cap
// upgrade path; the basic create endpoint enforces the cap inline so
// free users get a clean 403 with code='PLAN_REQUIRED').
//
// currentAmount is kept in lockstep with the GoalContribution rows by
// _recomputeCurrentAmount(). Manual recompute is cheaper than a full
// transaction-per-write and easier to verify than incremental deltas.

const mongoose = require('mongoose');
const { SavingsGoal } = require('../models/SavingsGoal');
const { GoalContribution } = require('../models/GoalContribution');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { parsePagination } = require('../utils/pagination');
const { NOTIFICATION_TYPES, SUBSCRIPTION_PLANS } = require('../config/constants');
const notifications = require('./notification.service');
const { advance } = require('./recurring.service');

const oid = (id) => new mongoose.Types.ObjectId(String(id));

const FREE_TIER_ACTIVE_GOAL_CAP = 1;

const toPublic = (g) => ({
  id: String(g._id),
  name: g.name,
  icon: g.icon || 'savings',
  color: g.color || '#26A69A',
  targetAmount: g.targetAmount,
  currency: g.currency,
  currentAmount: g.currentAmount || 0,
  deadline: g.deadline,
  status: g.status,
  completedAt: g.completedAt || null,
  contributionRule: g.contributionRule
    ? {
        frequency: g.contributionRule.frequency,
        interval: g.contributionRule.interval,
        amount: g.contributionRule.amount,
        dayOfMonth: g.contributionRule.dayOfMonth,
        weekday: g.contributionRule.weekday,
        nextRunAt: g.contributionRule.nextRunAt,
        lastRunAt: g.contributionRule.lastRunAt,
      }
    : null,
  createdAt: g.createdAt,
});

const toPublicContribution = (c) => ({
  id: String(c._id),
  goalId: String(c.goal),
  amount: c.amount,
  occurredAt: c.occurredAt,
  source: c.source,
  note: c.note || '',
  createdAt: c.createdAt,
});

// ---------- CRUD ----------

const create = async (userId, payload) => {
  const user = await User.findById(userId).lean();
  if (!user) throw ApiError.unauthorized();

  if (user.plan !== SUBSCRIPTION_PLANS.PREMIUM) {
    const activeCount = await SavingsGoal.countDocuments({
      user: oid(userId),
      deletedAt: null,
      status: 'active',
    });
    if (activeCount >= FREE_TIER_ACTIVE_GOAL_CAP) {
      throw new ApiError(403, 'Free plan allows one active goal', {
        code: 'PLAN_REQUIRED',
        details: { upgradeTo: SUBSCRIPTION_PLANS.PREMIUM },
      });
    }
  }

  // Stamp nextRunAt onto contributionRule if present. The next run is
  // either the deadline of the cadence anchor or "now + one interval" —
  // we use now as the anchor so the first auto-contribution happens
  // one interval after creation, which matches the user expectation
  // ("don't yank money the moment I save the goal").
  let contributionRule = null;
  if (payload.contributionRule) {
    const nextRunAt = advance(new Date(), payload.contributionRule);
    contributionRule = { ...payload.contributionRule, nextRunAt };
  }

  const doc = await SavingsGoal.create({
    user: userId,
    name: payload.name,
    icon: payload.icon || 'savings',
    color: payload.color || '#26A69A',
    targetAmount: payload.targetAmount,
    currency: payload.currency || 'INR',
    deadline: payload.deadline,
    contributionRule,
  });

  return toPublic(doc);
};

const list = async (userId, { status } = {}) => {
  const filter = { user: oid(userId), deletedAt: null };
  if (status) filter.status = status;
  const docs = await SavingsGoal.find(filter).sort({ status: 1, deadline: 1 }).lean();
  return docs.map(toPublic);
};

const get = async (userId, id) => {
  const doc = await SavingsGoal.findOne({ _id: id, user: oid(userId), deletedAt: null }).lean();
  if (!doc) throw ApiError.notFound('Goal not found');
  return toPublic(doc);
};

const update = async (userId, id, patch) => {
  const set = { ...patch };
  if (set.contributionRule === null) {
    // Explicit null = remove the rule entirely.
    set.contributionRule = null;
  } else if (set.contributionRule) {
    set.contributionRule = {
      ...set.contributionRule,
      nextRunAt: advance(new Date(), set.contributionRule),
    };
  }

  const doc = await SavingsGoal.findOneAndUpdate(
    { _id: id, user: oid(userId), deletedAt: null },
    { $set: set },
    { new: true, runValidators: true, context: 'query' }
  ).lean();
  if (!doc) throw ApiError.notFound('Goal not found');
  return toPublic(doc);
};

const softDelete = async (userId, id) => {
  const doc = await SavingsGoal.findOneAndUpdate(
    { _id: id, user: oid(userId), deletedAt: null },
    { $set: { deletedAt: new Date(), status: 'abandoned' } }
  );
  if (!doc) throw ApiError.notFound('Goal not found');
};

// ---------- Contributions ----------

const _recomputeCurrentAmount = async (goalId) => {
  const [agg] = await GoalContribution.aggregate([
    { $match: { goal: oid(goalId), deletedAt: null } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const total = Math.max(0, agg?.total || 0);
  await SavingsGoal.updateOne({ _id: goalId }, { $set: { currentAmount: total } });
  return total;
};

const contribute = async (userId, goalId, payload, { source = 'manual' } = {}) => {
  const goal = await SavingsGoal.findOne({
    _id: goalId,
    user: oid(userId),
    deletedAt: null,
  });
  if (!goal) throw ApiError.notFound('Goal not found');
  if (goal.status !== 'active') {
    throw ApiError.badRequest(`Goal is ${goal.status}; cannot contribute`);
  }

  const c = await GoalContribution.create({
    user: userId,
    goal: goal._id,
    amount: payload.amount,
    occurredAt: payload.occurredAt || new Date(),
    source,
    note: payload.note || '',
  });

  const total = await _recomputeCurrentAmount(goal._id);

  // Goal hit transition — fire once when crossing the threshold.
  if (total >= goal.targetAmount && goal.status === 'active') {
    goal.status = 'completed';
    goal.completedAt = new Date();
    // Stop auto-contributions on hit (plan §5 edge case).
    if (goal.contributionRule) goal.contributionRule = null;
    await goal.save();

    notifications
      .dispatch({
        user: goal.user,
        type: NOTIFICATION_TYPES.ANNOUNCEMENT,
        title: `${goal.name} reached!`,
        body: `You hit your ${goal.targetAmount} ${goal.currency} target.`,
        data: { goalId: String(goal._id) },
        deepLink: `/savings/${goal._id}`,
      })
      .catch((err) => logger.warn('goal-hit notify failed', { message: err.message }));
  }

  return {
    contribution: toPublicContribution(c),
    currentAmount: total,
    status: goal.status,
  };
};

const listContributions = async (userId, goalId, q = {}) => {
  // Confirm the goal belongs to the caller before paging through
  // contributions (otherwise an attacker with a goal id could fish).
  const owns = await SavingsGoal.exists({ _id: goalId, user: oid(userId) });
  if (!owns) throw ApiError.notFound('Goal not found');

  const { page, limit, skip } = parsePagination(q);
  const filter = { goal: oid(goalId), deletedAt: null };
  const [items, total] = await Promise.all([
    GoalContribution.find(filter).sort({ occurredAt: -1 }).skip(skip).limit(limit).lean(),
    GoalContribution.countDocuments(filter),
  ]);
  return { items: items.map(toPublicContribution), page, limit, total };
};

// ---------- Status calc ----------
//
// Linear projection: at the current contribution rate (last 30 days),
// will the user hit the target by the deadline? Returns a derived shape:
//
//   {
//     currentAmount, targetAmount, percent,
//     daysRemaining, projectedAmount, onTrack: bool,
//     dailyRateRequired, dailyRateActual,
//   }

const status = async (userId, goalId, now = new Date()) => {
  const goal = await SavingsGoal.findOne({
    _id: goalId,
    user: oid(userId),
    deletedAt: null,
  }).lean();
  if (!goal) throw ApiError.notFound('Goal not found');

  const since = new Date(now.getTime() - 30 * 86400_000);
  const [recent] = await GoalContribution.aggregate([
    {
      $match: {
        goal: oid(goalId),
        deletedAt: null,
        occurredAt: { $gte: since, $lte: now },
      },
    },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const last30Total = Math.max(0, recent?.total || 0);
  const dailyRateActual = last30Total / 30;

  const remaining = Math.max(0, goal.targetAmount - (goal.currentAmount || 0));
  const daysRemaining = Math.max(
    0,
    Math.ceil((goal.deadline.getTime() - now.getTime()) / 86400_000)
  );
  const dailyRateRequired = daysRemaining > 0 ? remaining / daysRemaining : remaining;

  const projectedAmount = (goal.currentAmount || 0) + dailyRateActual * daysRemaining;
  const onTrack = projectedAmount >= goal.targetAmount;
  const percent = Math.min(
    100,
    Math.round(((goal.currentAmount || 0) / goal.targetAmount) * 100)
  );

  return {
    goalId: String(goal._id),
    currentAmount: goal.currentAmount || 0,
    targetAmount: goal.targetAmount,
    percent,
    daysRemaining,
    projectedAmount: Math.round(projectedAmount * 100) / 100,
    onTrack,
    dailyRateRequired: Math.round(dailyRateRequired * 100) / 100,
    dailyRateActual: Math.round(dailyRateActual * 100) / 100,
  };
};

// ---------- Cron — auto-contributions ----------
//
// Picked up by the existing cron at /api/cron/recurring; the route is
// extended to also call this entry-point.

const runAutoContributions = async ({ now = new Date(), maxPerGoal = 50 } = {}) => {
  const dueGoals = await SavingsGoal.find({
    status: 'active',
    deletedAt: null,
    'contributionRule.nextRunAt': { $lte: now },
  });

  let goalsProcessed = 0;
  let contributionsCreated = 0;

  for (const goal of dueGoals) {
    let iterations = 0;
    try {
      while (
        goal.contributionRule &&
        goal.contributionRule.nextRunAt <= now &&
        iterations < maxPerGoal &&
        goal.status === 'active'
      ) {
        await contribute(
          String(goal.user),
          String(goal._id),
          {
            amount: goal.contributionRule.amount,
            occurredAt: goal.contributionRule.nextRunAt,
            note: 'Auto-contribution',
          },
          { source: 'auto' }
        );
        contributionsCreated += 1;

        // Reload to pick up any goal.status='completed' transition that
        // contribute() may have applied.
        const fresh = await SavingsGoal.findById(goal._id);
        if (!fresh || fresh.status !== 'active' || !fresh.contributionRule) break;

        fresh.contributionRule.lastRunAt = fresh.contributionRule.nextRunAt;
        fresh.contributionRule.nextRunAt = advance(fresh.contributionRule.nextRunAt, fresh.contributionRule);
        await fresh.save();
        goal.contributionRule = fresh.contributionRule;
        goal.status = fresh.status;
        iterations += 1;
      }
      goalsProcessed += 1;
    } catch (err) {
      logger.error('savings.runAutoContributions row failed', {
        goalId: String(goal._id),
        message: err.message,
      });
    }
  }

  return { goalsProcessed, contributionsCreated, at: now };
};

module.exports = {
  create,
  list,
  get,
  update,
  softDelete,
  contribute,
  listContributions,
  status,
  runAutoContributions,
  FREE_TIER_ACTIVE_GOAL_CAP,
  _recomputeCurrentAmount,
};
