const mongoose = require('mongoose');

// One row per (user, year, month). The score breakdown is stored so
// the mobile UI can render "what's driving your score" without a
// second compute pass — and so historical comparisons can show how
// each factor moved.
const financialScoreSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    period: {
      year: { type: Number, required: true },
      month: { type: Number, required: true, min: 1, max: 12 },
    },
    score: { type: Number, required: true, min: 0, max: 100 },

    factors: {
      budgetAdherence: { type: Number, default: 0, min: 0, max: 100 },
      savingsRate: { type: Number, default: 0, min: 0, max: 100 },
      recurringDiscretionaryRatio: { type: Number, default: 0, min: 0, max: 100 },
      expenseDiversification: { type: Number, default: 0, min: 0, max: 100 },
      goalProgress: { type: Number, default: 0, min: 0, max: 100 },
    },

    // Inputs used for the calc (for transparency + audit).
    inputs: {
      totalSpent: { type: Number, default: 0 },
      totalBudgeted: { type: Number, default: 0 },
      recurringSpent: { type: Number, default: 0 },
      categoriesActive: { type: Number, default: 0 },
      goalsActive: { type: Number, default: 0 },
      goalProgressRatioAvg: { type: Number, default: 0 },
    },

    computedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Unique (user, year, month) — recompute upserts onto the same row.
financialScoreSchema.index({ user: 1, 'period.year': 1, 'period.month': 1 }, { unique: true });
// History reads: newest first.
financialScoreSchema.index({ user: 1, 'period.year': -1, 'period.month': -1 });

module.exports =
  mongoose.models.FinancialScoreSnapshot
  || mongoose.model('FinancialScoreSnapshot', financialScoreSchema);
