// Subscription tracking service.
//
// Responsibilities (Phase 1 Feature 4):
//   - Promote a user to premium after receipt verification.
//   - Process inbound provider webhooks idempotently.
//   - Run two daily crons: expire lapsed subscriptions (past grace),
//     and fan out T-7 / T-3 / T-1 renewal reminders.
//   - Keep the denormalized `User.plan` + `User.planValidUntil` in
//     lockstep with the Subscription row so `requirePlan` never has
//     to join.
//
// The Subscription row is the source of truth; User fields are a
// cache. If they drift, _syncUserFromSub() is the single function
// responsible for reconciling them.

const mongoose = require('mongoose');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const WebhookEvent = require('../models/WebhookEvent');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const logger = require('../utils/logger');
const {
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_EVENT_TYPES,
  BILLING_PROVIDERS,
  NOTIFICATION_TYPES,
} = require('../config/constants');
const { getAdapter } = require('./billing');
const notifications = require('./notification.service');

const oid = (id) => new mongoose.Types.ObjectId(String(id));

// Catalog of available plans. Hard-coded for Phase 1; later phases
// can move this to a `plans` collection if A/B testing demands it.
// Prices are placeholders until real provider product IDs are wired.
const PLAN_CATALOG = [
  {
    id: 'premium_monthly',
    plan: SUBSCRIPTION_PLANS.PREMIUM,
    billingCycle: 'monthly',
    price: 99,
    currency: 'INR',
    description: 'Premium — monthly',
    features: ['Unlimited categories', 'Unlimited budgets', 'OCR', 'AI insights', 'Advanced reports'],
  },
  {
    id: 'premium_yearly',
    plan: SUBSCRIPTION_PLANS.PREMIUM,
    billingCycle: 'yearly',
    price: 799,
    currency: 'INR',
    description: 'Premium — yearly (save 33%)',
    features: ['Everything in monthly', '2 months free'],
  },
];

const _trimEvents = (events) => {
  // Cap audit history per plan §4 — keep last 100 once we exceed 200.
  if (!events || events.length <= 200) return events;
  return events.slice(events.length - 100);
};

const appendEvent = (sub, { type, provider = null, raw = null }) => {
  sub.events = _trimEvents([
    ...(sub.events || []),
    { at: new Date(), type, provider, raw },
  ]);
};

const toPublic = (sub) => ({
  id: String(sub._id),
  plan: sub.plan,
  status: sub.status,
  billingCycle: sub.billingCycle,
  price: sub.price || 0,
  currency: sub.currency,
  startedAt: sub.startedAt,
  currentPeriodStart: sub.currentPeriodStart || null,
  currentPeriodEnd: sub.currentPeriodEnd || null,
  cancelAt: sub.cancelAt || null,
  cancelledAt: sub.cancelledAt || null,
  trialEndsAt: sub.trialEndsAt || null,
  gracePeriodUntil: sub.gracePeriodUntil || null,
  provider: sub.provider || null,
  isPremium: sub.plan === SUBSCRIPTION_PLANS.PREMIUM
    && [SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.TRIALING].includes(sub.status),
  features: sub.features,
});

// Reconcile the cached User fields from the authoritative Subscription
// row. Called on every state transition (verify, webhook, cron, admin
// override). Idempotent.
const _syncUserFromSub = async (sub) => {
  const isActivePremium =
    sub.plan === SUBSCRIPTION_PLANS.PREMIUM
    && [SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.TRIALING].includes(sub.status);

  await User.updateOne(
    { _id: sub.user },
    {
      $set: {
        plan: isActivePremium ? SUBSCRIPTION_PLANS.PREMIUM : SUBSCRIPTION_PLANS.FREE,
        planValidUntil: isActivePremium ? sub.currentPeriodEnd || null : null,
      },
    }
  );
};

// ---------- Public API ----------

const listPlans = async () => ({ items: PLAN_CATALOG });

const getForUser = async (userId) => {
  let sub = await Subscription.findOne({ user: oid(userId) }).lean();
  if (!sub) {
    // Lazily create a "free" row so the mobile client always has
    // something to render. The unique index on `user` keeps this
    // collision-safe under concurrent requests.
    sub = await Subscription.findOneAndUpdate(
      { user: oid(userId) },
      { $setOnInsert: { user: oid(userId) } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
  }
  return toPublic(sub);
};

// Verify a purchase receipt with the provider and upsert the local row.
// `userId` is the authenticated caller; the receipt is associated with
// them, never with whoever the receipt's `original_transaction_id`
// happens to map to in some other system.
const verifyAndUpsert = async (userId, { provider, receipt, productId, platform }) => {
  const adapter = getAdapter(provider);
  const normalized = await adapter.verifyPurchase({ receipt, productId, userId });

  const sub = await Subscription.findOneAndUpdate(
    { user: oid(userId) },
    { $setOnInsert: { user: oid(userId) } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const previousPlan = sub.plan;
  sub.plan = normalized.plan;
  sub.status = SUBSCRIPTION_STATUS.ACTIVE;
  sub.billingCycle = normalized.billingCycle;
  sub.price = normalized.price;
  sub.currency = normalized.currency;
  sub.currentPeriodStart = normalized.currentPeriodStart;
  sub.currentPeriodEnd = normalized.currentPeriodEnd;
  sub.trialEndsAt = normalized.trialEndsAt || null;
  sub.provider = provider;
  sub.providerCustomerId = normalized.providerCustomerId || sub.providerCustomerId;
  sub.providerSubscriptionId = normalized.providerSubscriptionId || sub.providerSubscriptionId;
  sub.gracePeriodUntil = null;
  sub.cancelAt = null;
  sub.cancelledAt = null;
  sub.lastReminderSentAt = null;

  // Premium features unlocked at the schema level too — these are read
  // by the plan-aware UI bits that don't want to inline a plan check.
  if (sub.plan === SUBSCRIPTION_PLANS.PREMIUM) {
    sub.features = {
      maxCategories: 1000,
      maxRecurring: 1000,
      exportEnabled: true,
      advancedAnalytics: true,
    };
  }

  appendEvent(sub, {
    type:
      previousPlan === sub.plan
        ? SUBSCRIPTION_EVENT_TYPES.RENEWED
        : SUBSCRIPTION_EVENT_TYPES.CREATED,
    provider,
    raw: { productId, platform: platform || null },
  });

  await sub.save();
  await _syncUserFromSub(sub);

  // Welcome / upgrade notification — best-effort.
  notifications
    .dispatch({
      user: sub.user,
      type:
        previousPlan === SUBSCRIPTION_PLANS.PREMIUM
          ? NOTIFICATION_TYPES.SUBSCRIPTION_RENEWAL
          : NOTIFICATION_TYPES.SUBSCRIPTION_UPGRADED,
      title: previousPlan === SUBSCRIPTION_PLANS.PREMIUM ? 'Subscription renewed' : 'Welcome to Premium',
      body:
        previousPlan === SUBSCRIPTION_PLANS.PREMIUM
          ? `Your premium plan renewed through ${normalized.currentPeriodEnd?.toDateString?.() || ''}.`
          : 'Premium features are now active on your account.',
      data: { subscriptionId: String(sub._id) },
      deepLink: '/subscription',
    })
    .catch((err) => logger.warn('subscription welcome notify failed', { message: err.message }));

  return toPublic(sub);
};

// User-initiated cancel — defers actual provider cancellation if the
// adapter supports it (Stripe: cancel_at_period_end). For Apple, the
// adapter is a no-op and the user must cancel via their Apple ID.
const cancel = async (userId, { reason } = {}) => {
  const sub = await Subscription.findOne({ user: oid(userId) });
  // No sub row OR a free-plan sub both mean "you have nothing to
  // cancel" from the user's perspective — surface the same friendly
  // 400 in either case.
  if (!sub || sub.plan === SUBSCRIPTION_PLANS.FREE) {
    throw ApiError.badRequest('Nothing to cancel on the free plan');
  }
  if (sub.status === SUBSCRIPTION_STATUS.CANCELLED) {
    // Idempotent — return the same shape so the mobile UI doesn't
    // have to special-case a "double cancel" race.
    return toPublic(sub);
  }

  if (sub.provider && sub.providerSubscriptionId) {
    try {
      const adapter = getAdapter(sub.provider);
      await adapter.cancel({
        providerSubscriptionId: sub.providerSubscriptionId,
        productId: sub.providerCustomerId,
      });
    } catch (err) {
      // Don't block the local cancel on provider hiccups — the
      // webhook will eventually reconcile, and the user has already
      // expressed intent.
      logger.warn('provider.cancel failed; local state updated anyway', {
        provider: sub.provider,
        message: err.message,
      });
    }
  }

  sub.status = SUBSCRIPTION_STATUS.CANCELLED;
  sub.cancelledAt = new Date();
  sub.cancelAt = sub.currentPeriodEnd || new Date();
  appendEvent(sub, {
    type: SUBSCRIPTION_EVENT_TYPES.CANCELLED,
    provider: sub.provider,
    raw: { reason: reason || '' },
  });
  await sub.save();

  // User keeps premium until period end — don't downgrade User.plan yet.
  // The daily cron does that once currentPeriodEnd passes.

  notifications
    .dispatch({
      user: sub.user,
      type: NOTIFICATION_TYPES.SUBSCRIPTION_CANCELLED,
      title: 'Subscription cancelled',
      body: sub.currentPeriodEnd
        ? `Premium stays active until ${sub.currentPeriodEnd.toDateString()}.`
        : 'Your subscription has been cancelled.',
      data: { subscriptionId: String(sub._id) },
      deepLink: '/subscription',
    })
    .catch(() => {});

  return toPublic(sub);
};

// ---------- Webhook handler ----------

// Process a provider webhook. Idempotent: a duplicate eventId returns
// the prior result without re-applying. The route layer is responsible
// for signature verification and decoding the raw body into `event`.
const handleWebhook = async (provider, normalizedEvent, rawEventPayload = null) => {
  const { eventId, action, providerSubscriptionId, providerCustomerId, periodEnd, productId } =
    normalizedEvent;

  if (!eventId) throw ApiError.badRequest('Webhook missing eventId');

  const inserted = await WebhookEvent.findOneAndUpdate(
    { provider, eventId },
    {
      $setOnInsert: {
        provider,
        eventId,
        eventType: normalizedEvent.type || '',
        receivedAt: new Date(),
        raw: rawEventPayload,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  if (inserted.processedAt) {
    return { idempotent: true, action, eventId };
  }

  if (action === 'noop') {
    inserted.processedAt = new Date();
    await inserted.save();
    return { idempotent: false, action, eventId };
  }

  // Locate the local subscription. Order of preference:
  //   1. providerSubscriptionId (exact match)
  //   2. providerCustomerId (Stripe customer-scoped events)
  const sub = await Subscription.findOne(
    providerSubscriptionId
      ? { providerSubscriptionId }
      : { provider, providerCustomerId }
  );

  if (!sub) {
    inserted.error = `No local subscription matched provider=${provider} sub=${providerSubscriptionId} customer=${providerCustomerId}`;
    inserted.processedAt = new Date();
    await inserted.save();
    logger.warn('webhook for unknown subscription', {
      provider,
      eventId,
      providerSubscriptionId,
    });
    return { idempotent: false, action, eventId, unmatched: true };
  }

  try {
    await _applyWebhookAction(sub, action, { periodEnd, provider, productId, raw: rawEventPayload });
    inserted.processedAt = new Date();
    await inserted.save();
  } catch (err) {
    inserted.error = err.message;
    await inserted.save();
    throw err;
  }

  return { idempotent: false, action, eventId, subscriptionId: String(sub._id) };
};

const _applyWebhookAction = async (sub, action, { periodEnd, provider, productId, raw }) => {
  switch (action) {
    case 'renewed':
      sub.status = SUBSCRIPTION_STATUS.ACTIVE;
      sub.plan = SUBSCRIPTION_PLANS.PREMIUM;
      if (periodEnd) sub.currentPeriodEnd = periodEnd;
      sub.gracePeriodUntil = null;
      sub.lastReminderSentAt = null;
      appendEvent(sub, { type: SUBSCRIPTION_EVENT_TYPES.RENEWED, provider, raw });
      break;
    case 'payment_failed': {
      const graceMs = env.SUBSCRIPTION_GRACE_DAYS * 86400_000;
      sub.status = SUBSCRIPTION_STATUS.PAST_DUE;
      sub.gracePeriodUntil = new Date(Date.now() + graceMs);
      appendEvent(sub, { type: SUBSCRIPTION_EVENT_TYPES.PAYMENT_FAILED, provider, raw });
      appendEvent(sub, { type: SUBSCRIPTION_EVENT_TYPES.GRACE_STARTED, provider, raw: null });
      notifications
        .dispatch({
          user: sub.user,
          type: NOTIFICATION_TYPES.SUBSCRIPTION_PAYMENT_FAILED,
          title: 'Payment failed',
          body: `We couldn't process your renewal. Premium stays active until ${sub.gracePeriodUntil.toDateString()}.`,
          data: { subscriptionId: String(sub._id) },
          deepLink: '/subscription',
        })
        .catch(() => {});
      break;
    }
    case 'cancelled':
      sub.status = SUBSCRIPTION_STATUS.CANCELLED;
      sub.cancelledAt = sub.cancelledAt || new Date();
      sub.cancelAt = sub.currentPeriodEnd || new Date();
      appendEvent(sub, { type: SUBSCRIPTION_EVENT_TYPES.CANCELLED, provider, raw });
      break;
    case 'refunded':
      // Refund → immediate downgrade, regardless of currentPeriodEnd.
      sub.status = SUBSCRIPTION_STATUS.EXPIRED;
      sub.plan = SUBSCRIPTION_PLANS.FREE;
      sub.cancelledAt = new Date();
      appendEvent(sub, { type: SUBSCRIPTION_EVENT_TYPES.REFUNDED, provider, raw });
      break;
    case 'updated':
      appendEvent(sub, { type: SUBSCRIPTION_EVENT_TYPES.PLAN_CHANGED, provider, raw });
      break;
    default:
      break;
  }
  if (productId && !sub.providerSubscriptionId) {
    // Useful when Google webhook arrives before /verify (rare but possible).
    sub.providerSubscriptionId = sub.providerSubscriptionId || raw?.purchaseToken || null;
  }
  await sub.save();
  await _syncUserFromSub(sub);
};

// ---------- Cron jobs ----------

// Daily — downgrade subscriptions whose grace period has elapsed.
const expireDueSubscriptions = async (now = new Date()) => {
  const cursor = Subscription.find({
    $or: [
      { status: SUBSCRIPTION_STATUS.PAST_DUE, gracePeriodUntil: { $lte: now } },
      { status: SUBSCRIPTION_STATUS.CANCELLED, currentPeriodEnd: { $lte: now }, plan: SUBSCRIPTION_PLANS.PREMIUM },
    ],
  }).cursor();

  let expired = 0;
  for await (const sub of cursor) {
    sub.status = SUBSCRIPTION_STATUS.EXPIRED;
    sub.plan = SUBSCRIPTION_PLANS.FREE;
    appendEvent(sub, { type: SUBSCRIPTION_EVENT_TYPES.EXPIRED, provider: sub.provider });
    await sub.save();
    await _syncUserFromSub(sub);
    expired += 1;
  }
  return { expired };
};

// Daily — fire T-N renewal reminders. Idempotent within a billing cycle
// thanks to lastReminderSentAt being checked per window.
const sendRenewalReminders = async (now = new Date()) => {
  const reminderDays = env.SUBSCRIPTION_REMINDER_DAYS_AHEAD;
  if (!reminderDays.length) return { sent: 0 };

  // Look at subs renewing in the longest window we care about, then
  // bucket each one against the closest unfired window.
  const maxDays = Math.max(...reminderDays);
  const windowEnd = new Date(now.getTime() + maxDays * 86400_000);

  const cursor = Subscription.find({
    plan: SUBSCRIPTION_PLANS.PREMIUM,
    status: { $in: [SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.TRIALING] },
    currentPeriodEnd: { $gt: now, $lte: windowEnd },
  }).cursor();

  let sent = 0;
  for await (const sub of cursor) {
    const daysAhead = Math.ceil((sub.currentPeriodEnd.getTime() - now.getTime()) / 86400_000);
    const window = reminderDays.find((d) => d >= daysAhead) ?? null;
    if (window === null) continue;

    // Skip if we already sent a reminder for this billing cycle on
    // this window or a tighter one.
    if (
      sub.lastReminderSentAt
      && sub.lastReminderSentAt.getTime() >= now.getTime() - 86400_000
    ) {
      continue;
    }

    await notifications
      .dispatch({
        user: sub.user,
        type: NOTIFICATION_TYPES.SUBSCRIPTION_RENEWAL,
        title: `Premium renews in ${daysAhead} day${daysAhead === 1 ? '' : 's'}`,
        body: `Your subscription renews on ${sub.currentPeriodEnd.toDateString()}.`,
        data: { subscriptionId: String(sub._id), daysAhead },
        deepLink: '/subscription',
      })
      .catch((err) => logger.warn('renewal reminder dispatch failed', { message: err.message }));

    sub.lastReminderSentAt = now;
    await sub.save();
    sent += 1;
  }
  return { sent };
};

// Combined entry-point for the cron route.
const runDaily = async (now = new Date()) => {
  const expiry = await expireDueSubscriptions(now);
  const reminders = await sendRenewalReminders(now);
  return { ...expiry, ...reminders };
};

// ---------- Admin overrides ----------

const adminUpdate = async (id, patch = {}) => {
  const sub = await Subscription.findById(id);
  if (!sub) throw ApiError.notFound('Subscription not found');

  if (typeof patch.extendByDays === 'number') {
    const base = sub.currentPeriodEnd && sub.currentPeriodEnd > new Date()
      ? sub.currentPeriodEnd
      : new Date();
    sub.currentPeriodEnd = new Date(base.getTime() + patch.extendByDays * 86400_000);
    sub.status = SUBSCRIPTION_STATUS.ACTIVE;
    sub.plan = SUBSCRIPTION_PLANS.PREMIUM;
    sub.gracePeriodUntil = null;
    appendEvent(sub, {
      type: SUBSCRIPTION_EVENT_TYPES.ADMIN_COMPED,
      provider: BILLING_PROVIDERS.MANUAL,
      raw: { extendByDays: patch.extendByDays, note: patch.note || '' },
    });
  }
  if (patch.status) sub.status = patch.status;
  if (patch.plan) sub.plan = patch.plan;

  await sub.save();
  await _syncUserFromSub(sub);
  return toPublic(sub);
};

module.exports = {
  listPlans,
  getForUser,
  verifyAndUpsert,
  cancel,
  handleWebhook,
  expireDueSubscriptions,
  sendRenewalReminders,
  runDaily,
  adminUpdate,
  // Exposed for tests:
  _toPublic: toPublic,
  _appendEvent: appendEvent,
  _syncUserFromSub,
};
