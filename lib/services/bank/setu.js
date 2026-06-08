// Setu adapter — India bank sync via the RBI Account Aggregator
// framework. Requires regulatory approval before production use;
// the adapter is fully stubbed until the legal review lands.
//
// Setu's API is HTTPS / not SDK-based; calls happen via fetch().

const env = require('../../config/env');
const ApiError = require('../../utils/ApiError');

const isConfigured = () => Boolean(env.SETU_CLIENT_ID && env.SETU_SECRET);

const _requireConfig = () => {
  if (!isConfigured()) {
    throw new ApiError(503, 'Setu not configured', { code: 'BANK_NOT_CONFIGURED' });
  }
};

const initConnection = async () => {
  _requireConfig();
  // Setu's consent flow: create a Consent Request, get a redirect URL,
  // user authorizes via their bank app, Setu calls our webhook with
  // the consent handle. Stubbed until the legal sign-off.
  throw new ApiError(501, 'Setu connect flow pending legal review', { code: 'NOT_IMPLEMENTED' });
};

const exchangePublicToken = async () => {
  _requireConfig();
  throw new ApiError(501, 'Setu exchange flow pending legal review', { code: 'NOT_IMPLEMENTED' });
};

const fetchTransactions = async () => {
  _requireConfig();
  throw new ApiError(501, 'Setu transactions pending legal review', { code: 'NOT_IMPLEMENTED' });
};

const disconnect = async () => {
  _requireConfig();
  throw new ApiError(501, 'Setu disconnect pending legal review', { code: 'NOT_IMPLEMENTED' });
};

const verifyWebhookSignature = () => {
  _requireConfig();
  throw new ApiError(501, 'Setu webhook pending legal review', { code: 'NOT_IMPLEMENTED' });
};

const normalizeWebhookEvent = (event) => ({
  eventId: event?.uuid || event?.id || `setu-${Date.now()}`,
  type: `setu.${event?.type || 'unknown'}`,
  action: 'noop',
});

module.exports = {
  isConfigured,
  initConnection,
  exchangePublicToken,
  fetchTransactions,
  disconnect,
  verifyWebhookSignature,
  normalizeWebhookEvent,
};
