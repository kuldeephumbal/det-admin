const mongoose = require('mongoose');
const { PAYMENT_METHODS, CURRENCIES } = require('../config/constants');

const expenseSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Positive for normal user-entered expenses (enforced by Joi at the
    // route boundary). Internal-balance paths — `transfer` and
    // `debt-repayment` credit rows — write a NEGATIVE amount on the
    // receiving side so account-balance aggregation works as
    // `openingBalance + Σ(-amount)`. Schema-level `min: 0` would block
    // those, so the constraint is enforced at the public API layer
    // instead.
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      set: (v) => Math.round(Number(v) * 100) / 100,
    },
    currency: { type: String, enum: CURRENCIES, default: 'INR' },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: [true, 'Category is required'], index: true },
    date: { type: Date, required: [true, 'Date is required'], default: Date.now, index: true },
    note: { type: String, trim: true, maxlength: 500 },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: 'cash', index: true },
    tags: [{ type: String, trim: true, lowercase: true, maxlength: 30 }],
    attachmentUrl: { type: String, trim: true },
    recurringSource: { type: mongoose.Schema.Types.ObjectId, ref: 'RecurringExpense', default: null, index: true },
    // Per Feature 13 — every expense belongs to an Account (Cash, HDFC
    // Debit, Paytm, etc.). Backfilled to the user's default Cash account
    // by migration 012 for historical rows. Nullable to keep migrations
    // from rejecting rows mid-flight; service-level code enforces this on
    // new writes once Account UX ships on mobile.
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', default: null, index: true },
    // When this Expense is one half of an internal transfer between two
    // accounts, both rows share a stable `transferPair` id so analytics
    // can exclude them from spending totals.
    transferPair: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    // Provenance — where this row originated. 'manual' is the default
    // for legacy + UI entry; new sources stamp themselves explicitly so
    // analytics can split "imported" from "user-entered".
    source: {
      type: String,
      enum: ['manual', 'recurring', 'sms', 'ocr', 'bank-sync', 'transfer', 'debt-repayment'],
      default: 'manual',
      index: true,
    },
    // For SMS / bank-sync imports — external transaction id used for
    // dedupe. Sparse-unique per user so dual-imports (SMS + bank)
    // collapse into one row.
    externalId: { type: String, default: null },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

expenseSchema.index({ user: 1, date: -1 });
expenseSchema.index({ user: 1, category: 1, date: -1 });
expenseSchema.index({ user: 1, deletedAt: 1, date: -1 });
// Dedupe lookup for SMS/bank imports — `externalId` is sparse so manual
// rows (which leave it null) don't crowd the index.
expenseSchema.index(
  { user: 1, externalId: 1 },
  { unique: true, partialFilterExpression: { externalId: { $type: 'string' } } }
);

expenseSchema.query.byUser = function byUser(userId) {
  return this.where({ user: userId, deletedAt: null });
};

expenseSchema.statics.sumForUser = function sumForUser(userId, { from, to, category } = {}) {
  const match = { user: new mongoose.Types.ObjectId(String(userId)), deletedAt: null };
  if (from || to) {
    match.date = {};
    if (from) match.date.$gte = from;
    if (to) match.date.$lte = to;
  }
  if (category) match.category = new mongoose.Types.ObjectId(String(category));

  return this.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
};

module.exports = mongoose.models.Expense || mongoose.model('Expense', expenseSchema);
