// Stripe billing adapter.
//
// Used for web checkout (Stripe Checkout / Billing). NOT used on iOS —
// App Store guidelines mandate in-app purchase for digital subscriptions,
// so iOS clients hit the Apple adapter instead.
//
// The SDK (`stripe`) is loaded lazily so a dev install without billing
// credentials doesn't have to add the dependency. When the env vars
// aren't set, every operation throws ApiError(503, 'BILLING_NOT_CONFIGURED')
// — money paths must never silently no-op.

const crypto = require('crypto');
const env = require('../../config/env');
const ApiError = require('../../utils/ApiError');
const { BILLING_PROVIDERS, SUBSCRIPTION_PLANS } = require('../../config/constants');

// Hide the optional `stripe` require from webpack's static analyser so
// the build succeeds when the SDK isn't installed yet. Same pattern as
// fcm.service.js / billing/google.js — at runtime, `_getClient` only
// fires when STRIPE_SECRET_KEY is present, by which point the package
// is expected to be installed too.
const _loadStripeSdk = () => {
  // eslint-disable-next-line no-eval
  const nodeRequire = eval('require');
  try {
    return nodeRequire('stripe');
  } catch (_) {
    throw new ApiError(503, 'Stripe SDK not installed', {
      code: 'BILLING_NOT_CONFIGURED',
      detail: 'Run `npm install stripe` on the server',
    });
  }
};

let _client = null;
const _getClient = () => {
  if (_client) return _client;
  if (!env.STRIPE_SECRET_KEY) {
    throw new ApiError(503, 'Stripe not configured', { code: 'BILLING_NOT_CONFIGURED' });
  }
  const Stripe = _loadStripeSdk();
  _client = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
  return _client;
};

const isConfigured = () => Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET);

// Verify a purchase via Stripe Subscription id (the client retrieves it
// after Checkout completes and forwards it). The Subscription object
// already contains everything we need to upsert the local row, so no
// receipt parsing is required — unlike Apple/Google.
const verifyPurchase = async ({ receipt, productId }) => {
  const stripe = _getClient();
  // `receipt` for Stripe is the Subscription id ("sub_..."). Reject
  // anything obviously wrong before paying for an API call.
  if (!receipt.startsWith('sub_')) {
    throw ApiError.badRequest('Expected a Stripe subscription id (sub_...)');
  }

  const sub = await stripe.subscriptions.retrieve(receipt, { expand: ['items.data.price.product'] });
  if (!sub || sub.status === 'canceled') {
    throw ApiError.badRequest('Stripe subscription not active');
  }

  const item = sub.items.data[0];
  if (!item) throw ApiError.badRequest('Stripe subscription has no line items');

  // Map the Stripe price interval to our internal billingCycle.
  const interval = item.price?.recurring?.interval;
  const billingCycle =
    interval === 'year' ? 'yearly' : interval === 'month' ? 'monthly' : 'monthly';

  return {
    providerCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id || null,
    providerSubscriptionId: sub.id,
    plan: SUBSCRIPTION_PLANS.PREMIUM,
    billingCycle,
    price: (item.price?.unit_amount || 0) / 100,
    currency: (item.price?.currency || 'INR').toUpperCase(),
    currentPeriodStart: new Date(sub.current_period_start * 1000),
    currentPeriodEnd: new Date(sub.current_period_end * 1000),
    trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
    productId,
  };
};

const cancel = async ({ providerSubscriptionId }) => {
  const stripe = _getClient();
  // `cancel_at_period_end` lets the user keep premium until the period
  // they've already paid for ends — what every consumer expects.
  const updated = await stripe.subscriptions.update(providerSubscriptionId, {
    cancel_at_period_end: true,
  });
  return {
    cancelAt: updated.cancel_at ? new Date(updated.cancel_at * 1000) : null,
  };
};

const verifyWebhookSignature = (rawBody, headers) => {
  if (!isConfigured()) {
    throw new ApiError(503, 'Stripe webhook not configured', { code: 'BILLING_NOT_CONFIGURED' });
  }
  const signature = headers['stripe-signature'] || headers.get?.('stripe-signature');
  if (!signature) throw ApiError.unauthorized('Missing Stripe signature');

  const stripe = _getClient();
  try {
    return stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    // constructEvent throws on tampered payloads — surface as 401 so
    // attackers can't tell legit-but-misrouted from forged.
    throw ApiError.unauthorized('Invalid Stripe signature');
  }
};

// Map Stripe event types to our internal action vocabulary. Anything
// outside this set is recorded with action='noop' so the audit trail
// still has it but the service does nothing.
const normalizeWebhookEvent = (event) => {
  const sub = event.data?.object || {};
  const base = {
    eventId: event.id,
    type: event.type,
    provider: BILLING_PROVIDERS.STRIPE,
    providerSubscriptionId: sub.id || sub.subscription || null,
    providerCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id || null,
    periodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
    action: 'noop',
  };

  switch (event.type) {
    case 'customer.subscription.updated':
      // status transitions encode the real action.
      if (sub.status === 'active' || sub.status === 'trialing') base.action = 'renewed';
      else if (sub.status === 'past_due') base.action = 'payment_failed';
      else if (sub.status === 'canceled') base.action = 'cancelled';
      else base.action = 'updated';
      break;
    case 'customer.subscription.deleted':
      base.action = 'cancelled';
      break;
    case 'invoice.payment_succeeded':
      base.action = 'renewed';
      break;
    case 'invoice.payment_failed':
      base.action = 'payment_failed';
      break;
    case 'charge.refunded':
      base.action = 'refunded';
      break;
    default:
      base.action = 'noop';
  }
  return base;
};

// Used by tests that don't want to depend on the real SDK signing path.
// Production code goes through verifyWebhookSignature.
const __testSignBody = (rawBody, secret = env.STRIPE_WEBHOOK_SECRET, ts = Math.floor(Date.now() / 1000)) => {
  const payload = `${ts}.${rawBody}`;
  const v1 = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `t=${ts},v1=${v1}`;
};

module.exports = {
  isConfigured,
  verifyPurchase,
  cancel,
  verifyWebhookSignature,
  normalizeWebhookEvent,
  __testSignBody,
};
