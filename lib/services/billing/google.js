// Google Play Billing adapter.
//
// On Android, the client gets a purchase token from the Play Billing
// library and POSTs it to /subscriptions/verify. We validate it via
// the Android Publisher API (`purchases.subscriptionsv2.get`).
//
// Real-time updates arrive as Cloud Pub/Sub push messages to the
// webhook endpoint; their authenticity is a signed JWT in the
// `Authorization: Bearer` header.

const env = require('../../config/env');
const ApiError = require('../../utils/ApiError');
const { BILLING_PROVIDERS, SUBSCRIPTION_PLANS } = require('../../config/constants');

// `googleapis` is an optional dependency — only needed when the Play
// Billing integration is actually configured. Webpack statically
// analyses literal `require('googleapis')` calls and fails the build
// if the module isn't installed, even inside a function body. Going
// through Node's `eval('require')` hides the import from webpack's
// static analysis so the build succeeds without the package; at
// runtime, `_getAuth` only fires when env keys are present, by which
// point we expect the package to be installed too.
const _loadGoogleApis = () => {
  // eslint-disable-next-line no-eval
  const nodeRequire = eval('require');
  try {
    return nodeRequire('googleapis');
  } catch (e) {
    throw new ApiError(503, 'Google Play billing dependency not installed', {
      code: 'BILLING_NOT_CONFIGURED',
      detail: 'Run `npm install googleapis` on the server',
    });
  }
};

let _auth = null;
const _getAuth = async () => {
  if (_auth) return _auth;
  if (!env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON || !env.GOOGLE_PLAY_PACKAGE_NAME) {
    throw new ApiError(503, 'Google Play not configured', { code: 'BILLING_NOT_CONFIGURED' });
  }
  const { google } = _loadGoogleApis();
  const credentials = JSON.parse(
    Buffer.from(env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON, 'base64').toString('utf8')
  );
  _auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });
  return _auth;
};

const isConfigured = () =>
  Boolean(env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON && env.GOOGLE_PLAY_PACKAGE_NAME);

// Verify a Play purchase token. `receipt` here is the purchaseToken
// returned by the Play Billing client SDK; `productId` is the
// subscription SKU (e.g., "premium_monthly").
const verifyPurchase = async ({ receipt, productId }) => {
  const { google } = _loadGoogleApis();
  const auth = await _getAuth();
  const androidpublisher = google.androidpublisher({ version: 'v3', auth });

  const res = await androidpublisher.purchases.subscriptions.get({
    packageName: env.GOOGLE_PLAY_PACKAGE_NAME,
    subscriptionId: productId,
    token: receipt,
  });

  const data = res.data || {};
  // paymentState: 0 = pending, 1 = received, 2 = free trial, 3 = pending deferred upgrade
  if (![1, 2].includes(data.paymentState)) {
    throw ApiError.badRequest('Google Play purchase not in a paid state');
  }

  const start = data.startTimeMillis ? new Date(parseInt(data.startTimeMillis, 10)) : new Date();
  const end = data.expiryTimeMillis ? new Date(parseInt(data.expiryTimeMillis, 10)) : null;
  if (!end) throw ApiError.badRequest('Google Play purchase has no expiryTime');

  const billingCycle =
    data.autoRenewing && /year/i.test(productId) ? 'yearly' : 'monthly';

  return {
    providerCustomerId: data.obfuscatedExternalAccountId || null,
    providerSubscriptionId: receipt, // Play uses the token as the canonical id
    plan: SUBSCRIPTION_PLANS.PREMIUM,
    billingCycle,
    price: data.priceAmountMicros ? parseInt(data.priceAmountMicros, 10) / 1_000_000 : 0,
    currency: (data.priceCurrencyCode || 'INR').toUpperCase(),
    currentPeriodStart: start,
    currentPeriodEnd: end,
    trialEndsAt: data.paymentState === 2 ? end : null,
    productId,
  };
};

const cancel = async ({ providerSubscriptionId, productId }) => {
  const { google } = _loadGoogleApis();
  const auth = await _getAuth();
  const androidpublisher = google.androidpublisher({ version: 'v3', auth });

  await androidpublisher.purchases.subscriptions.cancel({
    packageName: env.GOOGLE_PLAY_PACKAGE_NAME,
    subscriptionId: productId,
    token: providerSubscriptionId,
  });
  return { cancelAt: null };
};

// Pub/Sub push delivers a JWT in `Authorization: Bearer ...` signed by
// Google. Validating it via the OIDC public keys is non-trivial and
// belongs in the route handler with `google-auth-library`; the adapter
// just consumes the verified payload.
const verifyWebhookSignature = (_rawBody, _headers) => {
  if (!isConfigured()) {
    throw new ApiError(503, 'Google Play webhook not configured', { code: 'BILLING_NOT_CONFIGURED' });
  }
  // Caller is expected to verify the bearer JWT before invoking this.
  throw new ApiError(501, 'Google webhook JWT verification handled at route layer', {
    code: 'NOT_IMPLEMENTED',
  });
};

// Pub/Sub message payload is a base64-encoded JSON of either
// SubscriptionNotification or VoidedPurchaseNotification.
const normalizeWebhookEvent = (event) => {
  const data = event.subscriptionNotification || {};
  const TYPE_MAP = {
    1: 'renewed',         // SUBSCRIPTION_RECOVERED
    2: 'renewed',         // SUBSCRIPTION_RENEWED
    3: 'cancelled',       // SUBSCRIPTION_CANCELED
    4: 'renewed',         // SUBSCRIPTION_PURCHASED
    5: 'payment_failed',  // SUBSCRIPTION_ON_HOLD
    6: 'payment_failed',  // SUBSCRIPTION_IN_GRACE_PERIOD
    7: 'updated',         // SUBSCRIPTION_RESTARTED
    12: 'refunded',       // SUBSCRIPTION_REVOKED
    13: 'cancelled',      // SUBSCRIPTION_EXPIRED
  };
  return {
    eventId: event.messageId || event.eventId || `${data.purchaseToken || ''}-${data.notificationType || ''}-${Date.now()}`,
    type: `google.${data.notificationType || 'unknown'}`,
    provider: BILLING_PROVIDERS.GOOGLE,
    providerSubscriptionId: data.purchaseToken || null,
    providerCustomerId: null,
    periodEnd: null, // requires a follow-up purchases.subscriptions.get to materialize
    action: TYPE_MAP[data.notificationType] || 'noop',
    productId: data.subscriptionId || null,
  };
};

module.exports = {
  isConfigured,
  verifyPurchase,
  cancel,
  verifyWebhookSignature,
  normalizeWebhookEvent,
};
