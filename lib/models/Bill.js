const mongoose = require('mongoose');
const { CURRENCIES, BILL_RECURRENCES } = require('../config/constants');

// Bill / planned payment — a future obligation with a due date.
//
// Distinct from RecurringExpense (which auto-materialises an Expense on
// schedule). A Bill captures "I expect to pay ₹X by date Z" and stays
// open until the user marks it paid; at that point we mint an Expense
// linked back via `paidExpense`. If the bill is recurring, paying it
// also creates the next instance in the chain (via `nextInstance`).
//
// State machine:
//   upcoming   → paidAt is null, dueDate > now
//   overdue    → paidAt is null, dueDate <= now
//   paid       → paidAt is set
// "Overdue" is computed at read time — we don't persist it as a status
// because it ages naturally with the clock.

const billSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: CURRENCIES, default: 'INR' },
    // Which account the user expects to pay from. Optional — some bills
    // (e.g. an SIP) don't have a clear source until payment day.
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', default: null },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },

    dueDate: { type: Date, required: true, index: true },

    // Recurrence shape. 'none' = one-shot. Anything else means "after
    // payment, mint the next instance with dueDate advanced".
    recurrence: { type: String, enum: BILL_RECURRENCES, default: 'none' },
    // Forward link in the recurrence chain. The original instance's
    // nextInstance points at the row created when the user paid it.
    nextInstance: { type: mongoose.Schema.Types.ObjectId, ref: 'Bill', default: null },
    // Back-pointer to the previous instance for audit / UI breadcrumbs.
    previousInstance: { type: mongoose.Schema.Types.ObjectId, ref: 'Bill', default: null },

    autoPay: { type: Boolean, default: false }, // informational, not enforced
    notes: { type: String, trim: true, maxlength: 500, default: '' },

    // Payment state.
    paidAt: { type: Date, default: null, index: true },
    paidAmount: { type: Number, default: null }, // actual paid (may differ from `amount`)
    paidExpense: { type: mongoose.Schema.Types.ObjectId, ref: 'Expense', default: null },

    // Reminder bookkeeping — set whenever the cron fires a push for
    // this bill so we don't double-send within a single calendar day.
    lastReminderSentAt: { type: Date, default: null },
    // Tracks which (days-ahead) windows we've already fired for. Stored
    // as an array of integers (e.g. [3, 1]); cleared on rollover.
    remindersFired: { type: [Number], default: [] },

    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

billSchema.index({ user: 1, paidAt: 1, dueDate: 1 });
billSchema.index({ user: 1, deletedAt: 1, dueDate: 1 });

billSchema.query.notDeleted = function notDeleted() {
  return this.where({ deletedAt: null });
};

// Virtual `state` computed from paidAt + dueDate. Not selectable in
// queries (use the explicit filters in bill.service for that), but
// exposed via toJSON / toObject getters for any direct reads.
billSchema.virtual('state').get(function state() {
  if (this.paidAt) return 'paid';
  if (this.dueDate && this.dueDate.getTime() <= Date.now()) return 'overdue';
  return 'upcoming';
});
billSchema.set('toJSON', { virtuals: true });
billSchema.set('toObject', { virtuals: true });

module.exports = mongoose.models.Bill || mongoose.model('Bill', billSchema);
