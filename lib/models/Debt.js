const mongoose = require('mongoose');
const { CURRENCIES, DEBT_TYPES, DEBT_STATUSES } = require('../config/constants');

// Two-way debt ledger (Feature 15).
//
//   type = 'lent'      → I gave money out; the counterparty owes me (asset).
//   type = 'borrowed'  → I received money; I owe the counterparty (liability).
//
// `originalAmount` is the principal at creation; `outstanding` shrinks
// as repayments come in. Status flips to 'settled' when outstanding
// drops to zero (or below — over-payments are allowed and surfaced as
// a settlement note rather than refused).
//
// Privacy: counterparty is free-text the user chooses ("Mike", "Mom").
// Admins never see this — see admin.service.js privacy-rule block.

const debtSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: DEBT_TYPES, required: true },
    counterparty: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },

    originalAmount: { type: Number, required: true, min: 0.01 },
    // Cached running outstanding — kept in lockstep with DebtRepayment
    // rows by debt.service._recompute. Source of truth for the
    // settled-vs-outstanding state.
    outstanding: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: CURRENCIES, default: 'INR' },
    // Optional default account — pre-fills the repayment sheet.
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', default: null },

    dueDate: { type: Date, default: null },
    note: { type: String, trim: true, maxlength: 500, default: '' },

    status: { type: String, enum: DEBT_STATUSES, default: 'outstanding', index: true },
    settledAt: { type: Date, default: null },

    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

debtSchema.index({ user: 1, status: 1, type: 1, createdAt: -1 });

debtSchema.query.notDeleted = function notDeleted() {
  return this.where({ deletedAt: null });
};

module.exports = mongoose.models.Debt || mongoose.model('Debt', debtSchema);
