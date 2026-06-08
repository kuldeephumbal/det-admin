// Stripe webhook receiver.
//
// Signature verification needs the EXACT raw body — Stripe HMACs over
// the bytes Stripe sent, not over a re-serialized JSON. So we sidestep
// withRoute (which JSON-parses) and use a thin handler that grabs
// req.text() before doing anything else.

const { NextResponse } = require('next/server');
const connectDB = require('@/lib/db');
const logger = require('@/lib/utils/logger');
const stripe = require('@/lib/services/billing/stripe');
const subscriptions = require('@/lib/services/subscription.service');
const { BILLING_PROVIDERS } = require('@/lib/config/constants');

const fail = (status, code, message) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

const handler = async (req) => {
  try {
    if (!stripe.isConfigured()) {
      return fail(503, 'BILLING_NOT_CONFIGURED', 'Stripe webhook secret not set');
    }

    await connectDB();

    const rawBody = await req.text();
    const headers = {
      'stripe-signature': req.headers.get('stripe-signature') || '',
    };

    let event;
    try {
      event = stripe.verifyWebhookSignature(rawBody, headers);
    } catch (err) {
      return fail(err.statusCode || 401, err.code || 'INVALID_SIGNATURE', err.message);
    }

    const normalized = stripe.normalizeWebhookEvent(event);
    const result = await subscriptions.handleWebhook(
      BILLING_PROVIDERS.STRIPE,
      normalized,
      event
    );
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    logger.error('stripe webhook failed', { message: err.message, stack: err.stack });
    return fail(500, 'INTERNAL_ERROR', err.message);
  }
};

exports.POST = handler;
