// Unit tests for subscription.service.
//
// Provider adapters are mocked through the billing module so the tests
// never touch Stripe/Apple/Google. Adapter contracts they fulfill:
//   - verifyPurchase({ receipt, productId }) → normalized purchase
//   - normalizeWebhookEvent(event) → { eventId, action, providerSubscriptionId, ... }
//
// What this file covers (per plan §16):
//   - free-row lazy creation on first /me access
//   - verify-and-upsert promotes to premium + syncs User.plan + planValidUntil
//   - cancel keeps premium until currentPeriodEnd
//   - handleWebhook idempotency (replay = single effect)
//   - expireDueSubscriptions downgrades past-grace rows
//   - adminUpdate.extendByDays bumps the period

jest.mock('../../lib/services/billing', () => {
  const { BILLING_PROVIDERS, SUBSCRIPTION_PLANS } = require('../../lib/config/constants');
  const stub = {
    isConfigured: () => true,
    verifyPurchase: jest.fn(),
    cancel: jest.fn(async () => ({ cancelAt: null })),
    normalizeWebhookEvent: jest.fn(),
  };
  return {
    __stub: stub,
    getAdapter: () => stub,
  };
});

const { ensureDb, makeUser } = require('../helpers');
const subscriptions = require('../../lib/services/subscription.service');
const Subscription = require('../../lib/models/Subscription');
const User = require('../../lib/models/User');
const WebhookEvent = require('../../lib/models/WebhookEvent');
const billing = require('../../lib/services/billing');
const {
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_STATUS,
  BILLING_PROVIDERS,
} = require('../../lib/config/constants');

const stub = billing.__stub;

beforeAll(ensureDb);
beforeEach(() => {
  stub.verifyPurchase.mockReset();
  stub.cancel.mockReset();
  stub.normalizeWebhookEvent.mockReset();
});

const flush = () => new Promise((r) => setImmediate(r));

describe('subscription.service.listPlans', () => {
  it('returns at least the two premium tiers', async () => {
    const { items } = await subscriptions.listPlans();
    const ids = items.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(['premium_monthly', 'premium_yearly']));
  });
});

describe('subscription.service.getForUser', () => {
  it('lazily creates a free row on first access', async () => {
    const user = await makeUser({ email: 'sub-lazy@example.com' });
    expect(await Subscription.countDocuments({ user: user._id })).toBe(0);

    const data = await subscriptions.getForUser(String(user._id));
    expect(data.plan).toBe(SUBSCRIPTION_PLANS.FREE);
    expect(data.isPremium).toBe(false);

    expect(await Subscription.countDocuments({ user: user._id })).toBe(1);
  });
});

describe('subscription.service.verifyAndUpsert', () => {
  it('promotes the user to premium and stamps planValidUntil', async () => {
    const user = await makeUser({ email: 'sub-up@example.com' });
    const periodEnd = new Date(Date.now() + 30 * 86400_000);
    stub.verifyPurchase.mockResolvedValueOnce({
      providerCustomerId: 'cus_X',
      providerSubscriptionId: 'sub_X',
      plan: SUBSCRIPTION_PLANS.PREMIUM,
      billingCycle: 'monthly',
      price: 99,
      currency: 'INR',
      currentPeriodStart: new Date(),
      currentPeriodEnd: periodEnd,
      trialEndsAt: null,
      productId: 'premium_monthly',
    });

    const result = await subscriptions.verifyAndUpsert(String(user._id), {
      provider: BILLING_PROVIDERS.STRIPE,
      receipt: 'sub_X',
      productId: 'premium_monthly',
    });

    expect(result.plan).toBe(SUBSCRIPTION_PLANS.PREMIUM);
    expect(result.isPremium).toBe(true);

    const reloaded = await User.findById(user._id).lean();
    expect(reloaded.plan).toBe(SUBSCRIPTION_PLANS.PREMIUM);
    expect(reloaded.planValidUntil.getTime()).toBe(periodEnd.getTime());

    const sub = await Subscription.findOne({ user: user._id }).lean();
    expect(sub.events.length).toBeGreaterThan(0);
    expect(sub.events[0].type).toBe('created');
  });
});

describe('subscription.service.cancel', () => {
  it('marks cancelled but keeps user.plan=premium until period end', async () => {
    const user = await makeUser({ email: 'sub-cancel@example.com' });
    const periodEnd = new Date(Date.now() + 10 * 86400_000);
    stub.verifyPurchase.mockResolvedValueOnce({
      providerCustomerId: 'cus_C',
      providerSubscriptionId: 'sub_C',
      plan: SUBSCRIPTION_PLANS.PREMIUM,
      billingCycle: 'monthly',
      price: 99,
      currency: 'INR',
      currentPeriodStart: new Date(),
      currentPeriodEnd: periodEnd,
      productId: 'premium_monthly',
    });

    await subscriptions.verifyAndUpsert(String(user._id), {
      provider: BILLING_PROVIDERS.STRIPE,
      receipt: 'sub_C',
      productId: 'premium_monthly',
    });

    const after = await subscriptions.cancel(String(user._id), { reason: 'too expensive' });
    expect(after.status).toBe(SUBSCRIPTION_STATUS.CANCELLED);
    expect(after.cancelAt.getTime()).toBe(periodEnd.getTime());

    // User row still premium for the grace window.
    const u = await User.findById(user._id).lean();
    expect(u.plan).toBe(SUBSCRIPTION_PLANS.PREMIUM);
  });

  it('refuses to cancel the free plan', async () => {
    const user = await makeUser({ email: 'sub-cancel-free@example.com' });
    await expect(subscriptions.cancel(String(user._id))).rejects.toThrow(/Nothing to cancel/);
  });
});

describe('subscription.service.handleWebhook', () => {
  it('is idempotent — same eventId twice = single state change', async () => {
    const user = await makeUser({ email: 'sub-webhook@example.com' });
    const periodEnd = new Date(Date.now() + 30 * 86400_000);
    stub.verifyPurchase.mockResolvedValueOnce({
      providerCustomerId: 'cus_W',
      providerSubscriptionId: 'sub_W',
      plan: SUBSCRIPTION_PLANS.PREMIUM,
      billingCycle: 'monthly',
      price: 99,
      currency: 'INR',
      currentPeriodStart: new Date(),
      currentPeriodEnd: periodEnd,
      productId: 'premium_monthly',
    });
    await subscriptions.verifyAndUpsert(String(user._id), {
      provider: BILLING_PROVIDERS.STRIPE,
      receipt: 'sub_W',
      productId: 'premium_monthly',
    });

    const newEnd = new Date(Date.now() + 60 * 86400_000);
    const normalized = {
      eventId: 'evt_renew_1',
      type: 'invoice.payment_succeeded',
      provider: BILLING_PROVIDERS.STRIPE,
      providerSubscriptionId: 'sub_W',
      providerCustomerId: 'cus_W',
      periodEnd: newEnd,
      action: 'renewed',
    };

    const r1 = await subscriptions.handleWebhook(BILLING_PROVIDERS.STRIPE, normalized);
    expect(r1.idempotent).toBe(false);

    const r2 = await subscriptions.handleWebhook(BILLING_PROVIDERS.STRIPE, normalized);
    expect(r2.idempotent).toBe(true);

    const sub = await Subscription.findOne({ user: user._id }).lean();
    expect(sub.currentPeriodEnd.getTime()).toBe(newEnd.getTime());

    // Renewal events for this user should only count once.
    const renewedEvents = sub.events.filter((e) => e.type === 'renewed');
    expect(renewedEvents.length).toBe(1);

    expect(await WebhookEvent.countDocuments({ provider: BILLING_PROVIDERS.STRIPE })).toBe(1);
  });

  it('marks payment_failed and sets gracePeriodUntil', async () => {
    const user = await makeUser({ email: 'sub-fail@example.com' });
    stub.verifyPurchase.mockResolvedValueOnce({
      providerCustomerId: 'cus_F',
      providerSubscriptionId: 'sub_F',
      plan: SUBSCRIPTION_PLANS.PREMIUM,
      billingCycle: 'monthly',
      price: 99,
      currency: 'INR',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 86400_000),
      productId: 'premium_monthly',
    });
    await subscriptions.verifyAndUpsert(String(user._id), {
      provider: BILLING_PROVIDERS.STRIPE,
      receipt: 'sub_F',
      productId: 'premium_monthly',
    });

    await subscriptions.handleWebhook(BILLING_PROVIDERS.STRIPE, {
      eventId: 'evt_fail_1',
      type: 'invoice.payment_failed',
      provider: BILLING_PROVIDERS.STRIPE,
      providerSubscriptionId: 'sub_F',
      action: 'payment_failed',
    });

    const sub = await Subscription.findOne({ user: user._id }).lean();
    expect(sub.status).toBe(SUBSCRIPTION_STATUS.PAST_DUE);
    expect(sub.gracePeriodUntil).toBeInstanceOf(Date);
    await flush();
  });
});

describe('subscription.service.expireDueSubscriptions', () => {
  it('downgrades past-grace subscriptions', async () => {
    const user = await makeUser({ email: 'sub-expire@example.com' });
    await Subscription.create({
      user: user._id,
      plan: SUBSCRIPTION_PLANS.PREMIUM,
      status: SUBSCRIPTION_STATUS.PAST_DUE,
      gracePeriodUntil: new Date(Date.now() - 86400_000),
      provider: BILLING_PROVIDERS.STRIPE,
    });
    await User.updateOne({ _id: user._id }, { $set: { plan: 'premium' } });

    const { expired } = await subscriptions.expireDueSubscriptions();
    expect(expired).toBeGreaterThanOrEqual(1);

    const u = await User.findById(user._id).lean();
    expect(u.plan).toBe(SUBSCRIPTION_PLANS.FREE);
    const sub = await Subscription.findOne({ user: user._id }).lean();
    expect(sub.status).toBe(SUBSCRIPTION_STATUS.EXPIRED);
  });
});

describe('subscription.service.adminUpdate', () => {
  it('extendByDays bumps currentPeriodEnd and re-activates', async () => {
    const user = await makeUser({ email: 'sub-admin@example.com' });
    const sub = await Subscription.create({
      user: user._id,
      plan: SUBSCRIPTION_PLANS.FREE,
      status: SUBSCRIPTION_STATUS.EXPIRED,
    });
    const before = Date.now();
    const updated = await subscriptions.adminUpdate(String(sub._id), { extendByDays: 30, note: 'comp' });
    expect(updated.plan).toBe(SUBSCRIPTION_PLANS.PREMIUM);
    expect(updated.status).toBe(SUBSCRIPTION_STATUS.ACTIVE);
    expect(updated.currentPeriodEnd.getTime()).toBeGreaterThan(before);

    const u = await User.findById(user._id).lean();
    expect(u.plan).toBe(SUBSCRIPTION_PLANS.PREMIUM);
    expect(u.planValidUntil).toBeInstanceOf(Date);
  });
});
