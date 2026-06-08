const mongoose = require('mongoose');
const {
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_STATUS,
  CURRENCIES,
  SUBSCRIPTION_EVENT_TYPES,
} = require('../config/constants');

// Append-only audit trail of every state transition a subscription
// goes through (created, renewed, cancelled, payment_failed, etc.).
// Kept inline on the parent document for two reasons:
//   1. typical volume is small (<200 events per sub over its lifetime),
//   2. every read of the sub already needs the recent history alongside it.
// The service trims the array to the most recent 100 entries once it
// crosses 200, so the document stays well under the 16MB BSON ceiling.
const subscriptionEventSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now, required: true },
    type: { type: String, enum: Object.values(SUBSCRIPTION_EVENT_TYPES), required: true },
    provider: { type: String, default: null },
    // Provider-specific raw payload (Stripe event, Apple receipt, etc.) —
    // capped via the trim logic in subscription.service.appendEvent.
    raw: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

const subscriptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    plan: { type: String, enum: Object.values(SUBSCRIPTION_PLANS), default: SUBSCRIPTION_PLANS.FREE, index: true },
    status: { type: String, enum: Object.values(SUBSCRIPTION_STATUS), default: SUBSCRIPTION_STATUS.ACTIVE, index: true },
    billingCycle: { type: String, enum: ['monthly', 'yearly', 'lifetime'], default: 'monthly' },
    price: { type: Number, default: 0 },
    currency: { type: String, enum: CURRENCIES, default: 'INR' },

    startedAt: { type: Date, default: Date.now },
    currentPeriodStart: Date,
    currentPeriodEnd: { type: Date, index: true },
    cancelAt: Date,
    cancelledAt: Date,
    trialEndsAt: Date,
    // Active when the provider has reported a failed renewal but we're
    // still inside the SUBSCRIPTION_GRACE_DAYS window. Past this date,
    // the daily cron downgrades the user to `free`.
    gracePeriodUntil: { type: Date, default: null, index: true },

    provider: { type: String, default: null },
    providerCustomerId: { type: String, default: null },
    providerSubscriptionId: { type: String, default: null, index: true, sparse: true },

    features: {
      maxCategories: { type: Number, default: 8 },
      maxRecurring: { type: Number, default: 3 },
      exportEnabled: { type: Boolean, default: false },
      advancedAnalytics: { type: Boolean, default: false },
    },

    events: { type: [subscriptionEventSchema], default: [] },

    // T-N reminders bump this so we don't fire the same window twice in a
    // single billing cycle. Reset when currentPeriodEnd advances.
    lastReminderSentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Subscription || mongoose.model('Subscription', subscriptionSchema);
