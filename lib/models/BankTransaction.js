const mongoose = require('mongoose');
const { CURRENCIES } = require('../config/constants');

// Raw provider transactions. Source of truth for the dedupe key.
// Each row is mapped at sync-time to either:
//   - a new Expense (default), OR
//   - linked to an existing Expense (manual/SMS-imported) that
//     overlaps on (user, ~amount, ~day, merchant) — see
//     sync.service.js#dedupe.
// `expense` is the link back when fused.

const bankTransactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    connection: { type: mongoose.Schema.Types.ObjectId, ref: 'BankConnection', required: true, index: true },
    externalId: { type: String, required: true }, // provider's transaction id
    amount: { type: Number, required: true },
    currency: { type: String, enum: CURRENCIES, default: 'INR' },
    merchant: { type: String, default: '' },
    occurredAt: { type: Date, required: true, index: true },
    type: { type: String, enum: ['debit', 'credit'], required: true },
    raw: { type: mongoose.Schema.Types.Mixed, default: null },
    expense: { type: mongoose.Schema.Types.ObjectId, ref: 'Expense', default: null },
    dedupeStrategy: { type: String, default: '' }, // 'new'|'merged-sms'|'merged-manual'
  },
  { timestamps: true }
);

// Unique externalId per user — provider transaction ids aren't
// globally unique, so we scope by user.
bankTransactionSchema.index({ user: 1, externalId: 1 }, { unique: true });
bankTransactionSchema.index({ user: 1, occurredAt: -1 });

module.exports = {
  BankTransaction: mongoose.models.BankTransaction || mongoose.model('BankTransaction', bankTransactionSchema),
};
