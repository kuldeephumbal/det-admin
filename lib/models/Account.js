const mongoose = require('mongoose');
const { CURRENCIES, ACCOUNT_TYPES } = require('../config/constants');

// Per-user money buckets — every expense, contribution, bill payment, and
// debt repayment is linked to one Account. Replaces the old free-text
// `paymentMethod` field as the canonical "where did the money come from"
// signal. Backwards-compatible: existing rows get a seeded "Cash" account
// via migration 012, and `paymentMethod` stays on Expense for one release
// cycle before removal.
//
// The current balance is computed on read (opening + sum of credits minus
// debits) rather than stored. We cache the most recent value on the doc
// for O(1) reads and bump a version counter on every related write — see
// account.service.js#_recomputeBalance.

const accountSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 60 },
    type: { type: String, enum: Object.values(ACCOUNT_TYPES), required: true },
    icon: { type: String, trim: true, default: 'wallet' },
    color: { type: String, trim: true, default: '#5B7CFA' },
    currency: { type: String, enum: CURRENCIES, default: 'INR' },

    // Seed balance at creation. Negative is allowed (credit cards start
    // in the red), so we don't constrain the sign.
    openingBalance: { type: Number, default: 0 },

    // Last-4 of the card / account number, optional. Plaintext is fine —
    // it's not a secret by itself. Stored masked already (we never
    // accept full numbers from the client).
    accountMask: {
      type: String,
      default: '',
      maxlength: 4,
      match: [/^\d{0,4}$/, 'accountMask must be 0–4 digits'],
    },

    // Lifecycle. Archived accounts don't appear in pickers but their
    // historical expenses stay queryable.
    isArchived: { type: Boolean, default: false, index: true },
    // Loan accounts the user wants to hide from the net-worth ribbon
    // (e.g. a credit card whose limit they don't want surfaced).
    excludeFromTotals: { type: Boolean, default: false },

    // User-controlled order on the dashboard chip strip.
    sortOrder: { type: Number, default: 0 },

    // Denormalised cached balance — see service. Reads use this; writes
    // bump it via _recomputeBalance.
    cachedBalance: { type: Number, default: 0 },
    cachedBalanceAt: { type: Date, default: null },

    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

accountSchema.index({ user: 1, isArchived: 1, sortOrder: 1 });
accountSchema.index({ user: 1, deletedAt: 1 });

accountSchema.query.notDeleted = function notDeleted() {
  return this.where({ deletedAt: null });
};

module.exports = mongoose.models.Account || mongoose.model('Account', accountSchema);
