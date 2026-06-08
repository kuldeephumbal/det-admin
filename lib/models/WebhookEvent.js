const mongoose = require('mongoose');
const { BILLING_PROVIDERS } = require('../config/constants');

// Providers allowed in the idempotency store — billing AND bank-sync
// webhooks both live here. Adding a new provider? Append the string.
const WEBHOOK_PROVIDERS = [
  ...Object.values(BILLING_PROVIDERS),
  'plaid',
  'setu',
  'finvu',
];

// Idempotency store for inbound provider webhooks. Stripe in particular
// retries aggressively (and the dashboard can replay events manually),
// so every handler must short-circuit when the same eventId is seen
// twice. The unique `(provider, eventId)` index is the guard.
//
// `processedAt` is stamped only after the handler succeeds — a row
// with `processedAt = null` and a non-empty `error` means the event
// was received but its handler threw, and is safe to retry.
const webhookEventSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: WEBHOOK_PROVIDERS,
      required: true,
    },
    eventId: { type: String, required: true },
    eventType: { type: String, default: '' },
    receivedAt: { type: Date, default: Date.now },
    processedAt: { type: Date, default: null },
    raw: { type: mongoose.Schema.Types.Mixed, default: null },
    error: { type: String, default: '' },
  },
  { timestamps: true }
);

webhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });
webhookEventSchema.index({ provider: 1, processedAt: 1, receivedAt: -1 });

module.exports =
  mongoose.models.WebhookEvent || mongoose.model('WebhookEvent', webhookEventSchema);
