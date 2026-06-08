// Bank provider router. Mirrors the billing/ + ocr/ pattern.
//
// Adapter contract (each provider implements):
//   isConfigured() → bool
//   initConnection({ userId, region? }) → { linkToken | redirectUrl, providerSessionId }
//   exchangePublicToken({ publicToken, userId }) →
//     { accessToken, providerAccountId, bankName, accountMask, currency, tokenExpiresAt }
//   fetchTransactions({ accessToken, since, until? }) → [BankTransaction normalized]
//   disconnect({ accessToken }) → void
//   verifyWebhookSignature(rawBody, headers) → parsed event
//   normalizeWebhookEvent(event) → { eventId, type, action }
//
// Region routing happens here too — Indian users → Setu by default,
// US/EU → Plaid. The route layer passes the user's locale; this
// module picks the adapter.

const env = require('../../config/env');
const ApiError = require('../../utils/ApiError');
const plaid = require('./plaid');
const setu = require('./setu');

const ADAPTERS = { plaid, setu };

const get = (provider) => {
  const name = provider || env.BANK_PROVIDER_DEFAULT;
  const adapter = ADAPTERS[name];
  if (!adapter) throw ApiError.badRequest(`Unknown bank provider: ${name}`);
  return { adapter, name };
};

// Heuristic: India-based users get Setu, everyone else Plaid. Honor
// an explicit user-supplied override if it's a known adapter.
const pickForUser = (user, override) => {
  if (override && ADAPTERS[override]) return get(override);
  const tz = user?.preferences?.timezone || '';
  const locale = user?.preferences?.locale || '';
  if (tz.startsWith('Asia/') || locale.endsWith('-IN')) return get('setu');
  return get('plaid');
};

module.exports = { get, pickForUser };
