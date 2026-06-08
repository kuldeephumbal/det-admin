const mongoose = require('mongoose');

// One row per repayment event against a Debt. Mirrors the
// GoalContribution shape so analytics + admin can treat them similarly.
//
// `expense` back-links the Expense row that actually moved money
// between accounts. For 'borrowed' debts the expense is a normal debit;
// for 'lent' debts it's a negative-amount credit (same trick we use
// for transfers — see expense.account.touchAccount).

const debtRepaymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    debt: { type: mongoose.Schema.Types.ObjectId, ref: 'Debt', required: true, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    occurredAt: { type: Date, default: Date.now, index: true },
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', default: null },
    expense: { type: mongoose.Schema.Types.ObjectId, ref: 'Expense', default: null },
    note: { type: String, trim: true, maxlength: 200, default: '' },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

debtRepaymentSchema.index({ user: 1, debt: 1, occurredAt: -1 });

module.exports =
  mongoose.models.DebtRepayment || mongoose.model('DebtRepayment', debtRepaymentSchema);
