const mongoose = require('mongoose');
const { CURRENCIES, SPLIT_METHODS } = require('../config/constants');

// A shared expense within a Group. `paidBy` fronted the money; each
// entry in `splits` is what one member owes for THIS expense. The sum of
// `splits[].owed` equals `amount` (validated in split-expense.service,
// with a 1-cent rounding tolerance). Per-pair and net balances are
// derived from these rows + Settlements — there is no stored balance.
const splitShareSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    owed: { type: Number, required: true, min: 0 },
    // Raw input for percentage/shares methods, kept for audit + edit
    // pre-fill (e.g. 50 for 50%, or 2 for a 2-share weighting).
    shareValue: { type: Number, default: null },
  },
  { _id: false }
);

const splitExpenseSchema = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    description: { type: String, required: true, trim: true, minlength: 1, maxlength: 140 },
    amount: { type: Number, required: true, min: 0.01 },
    currency: { type: String, enum: CURRENCIES, default: 'INR' },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    splitMethod: { type: String, enum: SPLIT_METHODS, default: 'equal' },
    splits: { type: [splitShareSchema], default: [] },
    // Optional reuse of the existing personal Category taxonomy.
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    date: { type: Date, default: Date.now },
    note: { type: String, trim: true, maxlength: 500, default: '' },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

splitExpenseSchema.index({ group: 1, date: -1 });

splitExpenseSchema.query.notDeleted = function notDeleted() {
  return this.where({ deletedAt: null });
};

module.exports =
  mongoose.models.SplitExpense || mongoose.model('SplitExpense', splitExpenseSchema);
