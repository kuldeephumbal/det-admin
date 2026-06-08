const mongoose = require('mongoose');
const { CURRENCIES, RECURRING_FREQUENCIES } = require('../config/constants');

// Inline schema for the optional auto-contribution rule. Mirrors the
// shape of RecurringExpense's cadence config so the cron materializer
// can advance both with the same `advance(...)` helper.
const contributionRuleSchema = new mongoose.Schema(
  {
    frequency: { type: String, enum: RECURRING_FREQUENCIES, required: true },
    interval: { type: Number, default: 1, min: 1, max: 365 },
    amount: { type: Number, required: true, min: 0 },
    dayOfMonth: { type: Number, min: 1, max: 31, default: null },
    weekday: { type: Number, min: 0, max: 6, default: null },
    nextRunAt: { type: Date, required: true, index: true },
    lastRunAt: { type: Date, default: null },
  },
  { _id: false }
);

const SAVINGS_GOAL_STATUS = ['active', 'completed', 'abandoned'];

const savingsGoalSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    icon: { type: String, trim: true, default: 'savings' },
    color: { type: String, trim: true, default: '#26A69A' },

    targetAmount: { type: Number, required: true, min: 1 },
    currency: { type: String, enum: CURRENCIES, default: 'INR' },
    // Sum of contributions, denormalized for cheap status reads. The
    // service is responsible for keeping this in lockstep with the
    // GoalContribution rows.
    currentAmount: { type: Number, default: 0, min: 0 },

    deadline: { type: Date, required: true, index: true },
    contributionRule: { type: contributionRuleSchema, default: null },

    status: { type: String, enum: SAVINGS_GOAL_STATUS, default: 'active', index: true },
    completedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

// (user, status, deadline) — supports the "active goals nearest deadline" home widget.
savingsGoalSchema.index({ user: 1, status: 1, deadline: 1 });

savingsGoalSchema.query.notDeleted = function notDeleted() {
  return this.where({ deletedAt: null });
};

module.exports = {
  SavingsGoal: mongoose.models.SavingsGoal || mongoose.model('SavingsGoal', savingsGoalSchema),
  SAVINGS_GOAL_STATUS,
};
