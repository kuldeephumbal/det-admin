// Plaid adapter — US/CA/EU bank sync.
//
// Lazy-loaded `plaid` SDK. Until creds + the SDK land, every method
// throws BANK_NOT_CONFIGURED. The interface is fully wired so swap-in
// is a fill-in-the-blanks job.

const env = require('../../config/env');
const ApiError = require('../../utils/ApiError');

const isConfigured = () => Boolean(env.PLAID_CLIENT_ID && env.PLAID_SECRET);

const _requireConfig = () => {
  if (!isConfigured()) {
    throw new ApiError(503, 'Plaid not configured', { code: 'BANK_NOT_CONFIGURED' });
  }
};

let _client = null;
const _getClient = () => {
  if (_client) return _client;
  _requireConfig();
  // eslint-disable-next-line global-require
  const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');
  const config = new Configuration({
    basePath: PlaidEnvironments[env.PLAID_ENV] || PlaidEnvironments.sandbox,
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': env.PLAID_CLIENT_ID,
        'PLAID-SECRET': env.PLAID_SECRET,
      },
    },
  });
  _client = new PlaidApi(config);
  return _client;
};

const initConnection = async ({ userId }) => {
  const client = _getClient();
  const res = await client.linkTokenCreate({
    user: { client_user_id: String(userId) },
    client_name: 'DET',
    products: ['transactions'],
    country_codes: ['US', 'CA', 'GB'],
    language: 'en',
  });
  return {
    linkToken: res.data.link_token,
    providerSessionId: res.data.request_id,
  };
};

const exchangePublicToken = async ({ publicToken }) => {
  const client = _getClient();
  const res = await client.itemPublicTokenExchange({ public_token: publicToken });

  const accounts = await client.accountsGet({ access_token: res.data.access_token });
  const first = accounts.data.accounts?.[0] || {};

  return {
    accessToken: res.data.access_token,
    providerAccountId: res.data.item_id,
    bankName: accounts.data.item?.institution_id || '',
    accountMask: first.mask || '',
    currency: first.balances?.iso_currency_code || 'USD',
    tokenExpiresAt: null, // Plaid item tokens don't auto-expire in the same way; re-auth is webhook-driven
  };
};

const fetchTransactions = async ({ accessToken, since, until }) => {
  const client = _getClient();
  const res = await client.transactionsGet({
    access_token: accessToken,
    start_date: since.toISOString().slice(0, 10),
    end_date: (until || new Date()).toISOString().slice(0, 10),
    options: { count: 250 },
  });
  return (res.data.transactions || []).map((t) => ({
    externalId: t.transaction_id,
    amount: t.amount,
    currency: t.iso_currency_code || 'USD',
    merchant: t.merchant_name || t.name || '',
    occurredAt: new Date(t.date),
    type: t.amount >= 0 ? 'debit' : 'credit',
    raw: t,
  }));
};

const disconnect = async ({ accessToken }) => {
  const client = _getClient();
  await client.itemRemove({ access_token: accessToken });
};

const verifyWebhookSignature = (_rawBody, _headers) => {
  _requireConfig();
  // Plaid webhook verification uses JWT in the Plaid-Verification header;
  // requires `plaid` SDK's webhookVerificationKeyGet. Left for the
  // production wire-up — until creds land, refuse.
  throw new ApiError(501, 'Plaid webhook verification handled at route layer', {
    code: 'NOT_IMPLEMENTED',
  });
};

const normalizeWebhookEvent = (event) => ({
  eventId: event.webhook_code + ':' + (event.item_id || ''),
  type: `plaid.${event.webhook_type || ''}.${event.webhook_code || ''}`,
  providerAccountId: event.item_id,
  action: event.webhook_code === 'SYNC_UPDATES_AVAILABLE'
    ? 'sync_now'
    : event.webhook_code === 'ITEM_LOGIN_REQUIRED'
    ? 'reauth_required'
    : 'noop',
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
