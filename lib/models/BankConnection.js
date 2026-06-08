const mongoose = require('mongoose');
const { CURRENCIES } = require('../config/constants');

const BANK_CONNECTION_STATUS = ['active', 'requires_reauth', 'disconnected', 'error'];
const BANK_PROVIDERS = ['plaid', 'setu', 'finvu'];

// One row per (user, providerAccountId). The encrypted token blob
// lives here in `accessTokenEncrypted` — never read it directly;
// pull it through bank.service.decryptToken() which loads the env
// key and unseals.

const bankConnectionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    provider: { type: String, enum: BANK_PROVIDERS, required: true },
    providerAccountId: { type: String, required: true },
    accountMask: { type: String, default: '' }, // last 4 digits, OK to show user
    bankName: { type: String, default: '' },
    currency: { type: String, enum: CURRENCIES, default: 'INR' },

    // Opaque AES-256-GCM envelope. NEVER serialize this in any
    // toJSON / public projection — and never log it.
    accessTokenEncrypted: { type: String, required: true, select: false },

    status: { type: String, enum: BANK_CONNECTION_STATUS, default: 'active', index: true },
    lastSyncedAt: { type: Date, default: null },
    lastError: { type: String, default: '' },
    connectedAt: { type: Date, default: Date.now },

    // Track when the provider says the token is going to expire so
    // we can prompt the user to re-auth before sync starts failing.
    tokenExpiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Unique per user — re-connecting the same bank account upserts.
bankConnectionSchema.index({ user: 1, provider: 1, providerAccountId: 1 }, { unique: true });
bankConnectionSchema.index({ user: 1, status: 1, lastSyncedAt: 1 });

module.exports = {
  BankConnection: mongoose.models.BankConnection || mongoose.model('BankConnection', bankConnectionSchema),
  BANK_CONNECTION_STATUS,
  BANK_PROVIDERS,
};
