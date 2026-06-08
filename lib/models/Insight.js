const mongoose = require('mongoose');

// Generated insights, cached so the LLM isn't called per-view. The
// pipeline writes one row per detected pattern (or canned narration
// when the LLM is unconfigured) and the mobile feed paginates them.

const INSIGHT_TYPES = [
  'anomaly',          // unusually large expense vs personal baseline
  'category_spike',   // a category jumped MoM
  'weekly_summary',   // saturday digest
  'savings_window',   // an opportunity to save (e.g., recurring overlap)
  'goal_nudge',       // user is behind on a goal
  'budget_warning',   // projected to overshoot a budget
  'positive',         // congrats — score went up / goal hit / etc.
];

const SEVERITIES = ['info', 'low', 'medium', 'high'];

const insightSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: INSIGHT_TYPES, required: true, index: true },
    period: {
      from: { type: Date, required: true },
      to: { type: Date, required: true },
    },
    severity: { type: String, enum: SEVERITIES, default: 'info' },
    title: { type: String, required: true, maxlength: 120 },
    body: { type: String, required: true, maxlength: 1200 },
    // Aggregated numbers backing the narration — the LLM is only
    // allowed to *narrate* what we put in here, never invent values.
    data: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Optional CTA the mobile UI can render as a button.
    //   { label: 'Set budget for Food', deepLink: '/budgets/new?category=...' }
    cta: {
      label: { type: String, maxlength: 60, default: '' },
      deepLink: { type: String, maxlength: 200, default: '' },
    },

    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
    // The TTL index on `generatedAt` declared via schema.index() below
    // already creates the single-field index — `index: true` here would
    // be a duplicate and trips Mongoose's warning.
    generatedAt: { type: Date, default: Date.now },

    // Provenance — which model produced the narration (or 'canned'
    // when LLM was unconfigured / cost-capped).
    model: { type: String, default: 'canned' },
    costTokens: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// User feed — newest first, optionally filtered by read state.
insightSchema.index({ user: 1, generatedAt: -1 });
insightSchema.index({ user: 1, isRead: 1, generatedAt: -1 });

// TTL — 180 days, per plan §8.
insightSchema.index({ generatedAt: 1 }, { expireAfterSeconds: 180 * 86400 });

module.exports = {
  Insight: mongoose.models.Insight || mongoose.model('Insight', insightSchema),
  INSIGHT_TYPES,
  SEVERITIES,
};
