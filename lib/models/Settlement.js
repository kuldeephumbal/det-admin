const mongoose = require('mongoose');
const { CURRENCIES } = require('../config/constants');

// A recorded payback within a Group: `from` paid `to` to reduce a
// balance. Recording only — DET moves no real money. Factored into
// balance derivation alongside SplitExpense (a settlement shifts the
// pair balance by `amount`). Soft-deletable so undoing a settlement
// recalculates balances "as if it never happened".
const settlementSchema = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 0.01 },
    currency: { type: String, enum: CURRENCIES, default: 'INR' },
    note: { type: String, trim: true, maxlength: 300, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

settlementSchema.index({ group: 1, createdAt: -1 });

settlementSchema.query.notDeleted = function notDeleted() {
  return this.where({ deletedAt: null });
};

module.exports =
  mongoose.models.Settlement || mongoose.model('Settlement', settlementSchema);
