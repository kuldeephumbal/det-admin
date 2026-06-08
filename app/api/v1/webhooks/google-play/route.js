// Google Play (Cloud Pub/Sub) webhook receiver.
//
// Pub/Sub push delivers a JWT in `Authorization: Bearer ...` signed by
// Google. The payload's `message.data` is base64-encoded JSON of either
// a SubscriptionNotification or a VoidedPurchaseNotification.
//
// JWT verification requires `google-auth-library` and Google's OIDC
// public keys. The route validates the bearer token, then delegates
// the body parsing + normalization to the adapter.

const { NextResponse } = require('next/server');
const connectDB = require('@/lib/db');
const env = require('@/lib/config/env');
const logger = require('@/lib/utils/logger');
const google = require('@/lib/services/billing/google');
const subscriptions = require('@/lib/services/subscription.service');
const { BILLING_PROVIDERS } = require('@/lib/config/constants');

const fail = (status, code, message) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

const _verifyPubsubJwt = async (bearer) => {
  // eslint-disable-next-line global-require
  const { OAuth2Client } = require('google-auth-library');
  const client = new OAuth2Client();
  const ticket = await client.verifyIdToken({
    idToken: bearer,
    audience: env.GOOGLE_PLAY_PUBSUB_AUDIENCE || undefined,
  });
  return ticket.getPayload();
};

const handler = async (req) => {
  try {
    if (!google.isConfigured()) {
      return fail(503, 'BILLING_NOT_CONFIGURED', 'Google Play not configured');
    }

    const authHeader = req.headers.get('authorization') || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!bearer) return fail(401, 'UNAUTHORIZED', 'Missing bearer token');

    try {
      await _verifyPubsubJwt(bearer);
    } catch (err) {
      logger.warn('google webhook JWT verify failed', { message: err.message });
      return fail(401, 'UNAUTHORIZED', 'Invalid Pub/Sub token');
    }

    await connectDB();

    const envelope = await req.json();
    // Pub/Sub envelope: { message: { data: base64, messageId, attributes } }
    const data = envelope?.message?.data
      ? JSON.parse(Buffer.from(envelope.message.data, 'base64').toString('utf8'))
      : {};
    const event = {
      messageId: envelope?.message?.messageId,
      ...data,
    };

    const normalized = google.normalizeWebhookEvent(event);
    const result = await subscriptions.handleWebhook(
      BILLING_PROVIDERS.GOOGLE,
      normalized,
      event
    );
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    logger.error('google webhook failed', { message: err.message, stack: err.stack });
    return fail(500, 'INTERNAL_ERROR', err.message);
  }
};

exports.POST = handler;
