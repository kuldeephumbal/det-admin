const mongoose = require('mongoose');

const GOAL_CONTRIBUTION_SOURCES = ['manual', 'auto', 'bank'];

const goalContributionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    goal: { type: mongoose.Schema.Types.ObjectId, ref: 'SavingsGoal', required: true, index: true },
    // Signed: positive contributions add to the goal, negatives represent
    // withdrawals (allowed — see plan §5 risks). The aggregate sum is
    // stored on SavingsGoal.currentAmount.
    amount: { type: Number, required: true },
    occurredAt: { type: Date, default: Date.now, index: true },
    source: { type: String, enum: GOAL_CONTRIBUTION_SOURCES, default: 'manual' },
    note: { type: String, trim: true, maxlength: 200, default: '' },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

goalContributionSchema.index({ user: 1, goal: 1, occurredAt: -1 });

goalContributionSchema.query.notDeleted = function notDeleted() {
  return this.where({ deletedAt: null });
};

module.exports = {
  GoalContribution:
    mongoose.models.GoalContribution || mongoose.model('GoalContribution', goalContributionSchema),
  GOAL_CONTRIBUTION_SOURCES,
};
