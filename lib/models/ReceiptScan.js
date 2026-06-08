const mongoose = require('mongoose');
const { CURRENCIES } = require('../config/constants');

const RECEIPT_SCAN_STATUS = ['pending', 'processing', 'completed', 'failed'];

// Receipt scan workflow:
//   pending    — upload accepted, worker hasn't picked it up yet.
//   processing — worker pulled it; OCR provider call in flight.
//   completed  — extracted fields populated; user may convert to Expense.
//   failed     — error stamped on `error`; user can retry / discard.
//
// `extracted` is a denormalized snapshot of whatever the OCR adapter
// returned. Shape evolves with the adapter; treat it as freeform Mixed
// for now so adapter changes don't require migrations.

const receiptScanSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    imageUrl: { type: String, required: true },
    thumbnailUrl: { type: String, default: '' },
    storageKey: { type: String, required: true }, // internal, never exposed
    contentType: { type: String, default: '' },
    sizeBytes: { type: Number, default: 0 },

    status: { type: String, enum: RECEIPT_SCAN_STATUS, default: 'pending', index: true },
    ocrProvider: { type: String, default: '' },
    confidence: { type: Number, default: 0 },

    extracted: {
      merchant: { type: String, default: '' },
      total: { type: Number, default: 0 },
      currency: { type: String, enum: [...CURRENCIES, ''], default: '' },
      date: { type: Date, default: null },
      lineItems: { type: [mongoose.Schema.Types.Mixed], default: [] },
      raw: { type: mongoose.Schema.Types.Mixed, default: null },
    },

    expense: { type: mongoose.Schema.Types.ObjectId, ref: 'Expense', default: null },
    attempts: { type: Number, default: 0 },
    error: { type: String, default: '' },

    completedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

// Worker pickup index — `(status, createdAt asc)` lets the cron grab
// the oldest pending job O(1).
receiptScanSchema.index({ status: 1, createdAt: 1 });
// User history listing — newest first.
receiptScanSchema.index({ user: 1, createdAt: -1 });
// TTL on failed scans (30 days, per plan §6).
receiptScanSchema.index(
  { updatedAt: 1 },
  { expireAfterSeconds: 30 * 86400, partialFilterExpression: { status: 'failed' } }
);

receiptScanSchema.query.notDeleted = function notDeleted() {
  return this.where({ deletedAt: null });
};

module.exports = {
  ReceiptScan: mongoose.models.ReceiptScan || mongoose.model('ReceiptScan', receiptScanSchema),
  RECEIPT_SCAN_STATUS,
};
