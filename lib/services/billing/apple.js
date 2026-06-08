// Apple App Store billing adapter.
//
// On iOS, the client posts the base64 receipt blob to /verify, which we
// forward to Apple's `verifyReceipt` (legacy) or App Store Server API
// (modern). Modern flow uses signed JWS payloads via App Store Server
// Notifications V2 — that's the path implemented here.

const env = require('../../config/env');
const ApiError = require('../../utils/ApiError');
const { BILLING_PROVIDERS, SUBSCRIPTION_PLANS } = require('../../config/constants');

const isConfigured = () => Boolean(env.APPLE_SHARED_SECRET && env.APPLE_BUNDLE_ID);

const _requireConfig = () => {
  if (!isConfigured()) {
    throw new ApiError(503, 'Apple billing not configured', { code: 'BILLING_NOT_CONFIGURED' });
  }
};

// verifyReceipt against Apple's endpoint. Production-first, falling back
// to sandbox on Apple's 21007 ("This receipt is from sandbox") response —
// the documented dance for accepting both Test Flight and Production
// receipts through a single endpoint.
const _verifyAtApple = async (receiptData, isSandbox = false) => {
  const endpoint = isSandbox
    ? 'https://sandbox.itunes.apple.com/verifyReceipt'
    : 'https://buy.itunes.apple.com/verifyReceipt';

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      'receipt-data': receiptData,
      password: env.APPLE_SHARED_SECRET,
      'exclude-old-transactions': true,
    }),
  });
  const body = await res.json();
  if (body.status === 21007 && !isSandbox) {
    return _verifyAtApple(receiptData, true);
  }
  return body;
};

const verifyPurchase = async ({ receipt, productId }) => {
  _requireConfig();
  const body = await _verifyAtApple(receipt);
  if (body.status !== 0) {
    throw ApiError.badRequest(`Apple receipt invalid (status ${body.status})`);
  }

  const latest = (body.latest_receipt_info || []).find((r) => r.product_id === productId)
    || body.latest_receipt_info?.[0];
  if (!latest) throw ApiError.badRequest('Apple receipt has no matching transaction');

  const start = new Date(parseInt(latest.purchase_date_ms, 10));
  const end = new Date(parseInt(latest.expires_date_ms, 10));
  if (Number.isNaN(end.getTime())) {
    throw ApiError.badRequest('Apple receipt missing expires_date_ms');
  }

  const billingCycle = /year/i.test(productId) ? 'yearly' : 'monthly';

  return {
    providerCustomerId: latest.original_transaction_id || null,
    providerSubscriptionId: latest.transaction_id || latest.original_transaction_id,
    plan: SUBSCRIPTION_PLANS.PREMIUM,
    billingCycle,
    price: 0, // Apple doesn't return price on legacy verifyReceipt; pulled from product config separately
    currency: 'USD',
    currentPeriodStart: start,
    currentPeriodEnd: end,
    trialEndsAt: latest.is_trial_period === 'true' ? end : null,
    productId,
  };
};

const cancel = async () => {
  // Apple does not allow server-initiated cancellation. The user
  // cancels via their Apple ID settings; the server merely records
  // intent and updates state once the cancellation webhook fires.
  return { cancelAt: null };
};

// App Store Server Notifications V2 sends signedPayload (JWS). Real
// verification requires Apple's root CA chain — handled at the route
// layer with `app-store-server-api-node` or equivalent.
const verifyWebhookSignature = (_rawBody, _headers) => {
  _requireConfig();
  throw new ApiError(501, 'Apple webhook JWS verification handled at route layer', {
    code: 'NOT_IMPLEMENTED',
  });
};

const normalizeWebhookEvent = (event) => {
  // `event` is the decoded JWS payload (notificationType + subtype + data).
  const TYPE_MAP = {
    DID_RENEW: 'renewed',
    DID_FAIL_TO_RENEW: 'payment_failed',
    EXPIRED: 'cancelled',
    GRACE_PERIOD_EXPIRED: 'cancelled',
    REFUND: 'refunded',
    REVOKE: 'refunded',
    DID_CHANGE_RENEWAL_STATUS: 'updated',
    SUBSCRIBED: 'renewed',
  };
  return {
    eventId: event.notificationUUID || `apple-${event.notificationType}-${Date.now()}`,
    type: `apple.${event.notificationType || 'unknown'}`,
    provider: BILLING_PROVIDERS.APPLE,
    providerSubscriptionId:
      event.data?.transactionInfo?.originalTransactionId
      || event.data?.originalTransactionId
      || null,
    providerCustomerId: event.data?.appAccountToken || null,
    periodEnd: event.data?.transactionInfo?.expiresDate
      ? new Date(event.data.transactionInfo.expiresDate)
      : null,
    action: TYPE_MAP[event.notificationType] || 'noop',
    productId: event.data?.transactionInfo?.productId || null,
  };
};

module.exports = {
  isConfigured,
  verifyPurchase,
  cancel,
  verifyWebhookSignature,
  normalizeWebhookEvent,
};
