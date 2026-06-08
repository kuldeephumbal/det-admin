// Billing provider router.
//
// All billing call-sites go through `getAdapter(provider)` and use a
// uniform interface so the subscription service never branches on
// provider strings itself.
//
// Adapter contract (every provider must implement):
//   isConfigured()          : bool   — env has the secrets needed
//   verifyPurchase({ receipt, productId, userId }) → normalized purchase
//     returns {
//       providerCustomerId, providerSubscriptionId,
//       plan, billingCycle, price, currency,
//       currentPeriodStart, currentPeriodEnd,
//       trialEndsAt?,
//     }
//   cancel({ providerSubscriptionId }) → { cancelAt }
//   verifyWebhookSignature(rawBody, headers) → parsed event (or throws)
//   normalizeWebhookEvent(event) → {
//     eventId, type,
//     providerCustomerId?, providerSubscriptionId?,
//     action: 'renewed' | 'cancelled' | 'refunded' | 'payment_failed' | 'updated' | 'noop',
//     periodEnd?,
//   }
//
// Each adapter throws ApiError when called without configuration —
// never silently succeed on a money path.

const ApiError = require('../../utils/ApiError');
const { BILLING_PROVIDERS } = require('../../config/constants');

const stripe = require('./stripe');
const google = require('./google');
const apple = require('./apple');

const ADAPTERS = {
  [BILLING_PROVIDERS.STRIPE]: stripe,
  [BILLING_PROVIDERS.GOOGLE]: google,
  [BILLING_PROVIDERS.APPLE]: apple,
};

const getAdapter = (provider) => {
  const adapter = ADAPTERS[provider];
  if (!adapter) {
    throw ApiError.badRequest(`Unknown billing provider: ${provider}`);
  }
  return adapter;
};

module.exports = { getAdapter };
