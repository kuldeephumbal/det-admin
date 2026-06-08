// Apple App Store Server Notifications V2 receiver.
//
// Body is `{ signedPayload }` where signedPayload is a JWS signed by
// Apple. Verification requires the Apple root CA chain — handled
// here via `app-store-server-api-node` (or a custom JWS verifier).
//
// Until the SDK is installed, this route returns 503 so test traffic
// doesn't accidentally apply unsigned payloads.

const { NextResponse } = require('next/server');
const connectDB = require('@/lib/db');
const logger = require('@/lib/utils/logger');
const apple = require('@/lib/services/billing/apple');
const subscriptions = require('@/lib/services/subscription.service');
const { BILLING_PROVIDERS } = require('@/lib/config/constants');

const fail = (status, code, message) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

const _decodeAndVerifyJWS = async (_signedPayload) => {
  // eslint-disable-next-line global-require
  let appleApi;
  try {
    // eslint-disable-next-line global-require
    appleApi = require('app-store-server-api');
  } catch (_err) {
    throw new Error('app-store-server-api SDK not installed');
  }
  // Verifier needs the Apple root certs bundled with the SDK.
  const decoded = await appleApi.decodeNotificationPayload(_signedPayload);
  return decoded;
};

const handler = async (req) => {
  try {
    if (!apple.isConfigured()) {
      return fail(503, 'BILLING_NOT_CONFIGURED', 'Apple billing not configured');
    }

    await connectDB();

    const body = await req.json();
    if (!body?.signedPayload) {
      return fail(400, 'BAD_REQUEST', 'Missing signedPayload');
    }

    let decoded;
    try {
      decoded = await _decodeAndVerifyJWS(body.signedPayload);
    } catch (err) {
      logger.warn('apple webhook JWS verify failed', { message: err.message });
      return fail(401, 'INVALID_SIGNATURE', err.message);
    }

    const normalized = apple.normalizeWebhookEvent(decoded);
    const result = await subscriptions.handleWebhook(
      BILLING_PROVIDERS.APPLE,
      normalized,
      decoded
    );
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    logger.error('apple webhook failed', { message: err.message, stack: err.stack });
    return fail(500, 'INTERNAL_ERROR', err.message);
  }
};

exports.POST = handler;
