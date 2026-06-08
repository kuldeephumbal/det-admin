// Plaid webhook receiver.
//
// Plaid's webhooks land at this endpoint with a JWT in `Plaid-Verification`.
// Verification requires fetching Plaid's webhook public key, which the
// adapter handles. Routes here just orchestrate.

const { NextResponse } = require('next/server');
const connectDB = require('@/lib/db');
const logger = require('@/lib/utils/logger');
const plaid = require('@/lib/services/bank/plaid');
const WebhookEvent = require('@/lib/models/WebhookEvent');
const { BILLING_PROVIDERS } = require('@/lib/config/constants');

const fail = (status, code, message) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

// Webhook event idempotency leans on the same WebhookEvent table as
// billing. Provider stamp distinguishes them (BILLING_PROVIDERS list
// is reused — `plaid` is treated as a billing-like provider for the
// purposes of replay-protection bookkeeping, but the action flows
// into the bank sync pipeline, not subscriptions).
const handler = async (req) => {
  try {
    if (!plaid.isConfigured()) {
      return fail(503, 'BANK_NOT_CONFIGURED', 'Plaid not configured');
    }
    await connectDB();
    const rawBody = await req.text();
    const headers = { 'plaid-verification': req.headers.get('plaid-verification') || '' };

    let event;
    try {
      event = plaid.verifyWebhookSignature(rawBody, headers);
    } catch (err) {
      return fail(err.statusCode || 401, err.code || 'INVALID_SIGNATURE', err.message);
    }

    const normalized = plaid.normalizeWebhookEvent(event);

    // Use the WebhookEvent table for replay protection, even though
    // bank webhooks are conceptually different from billing.
    const eventId = normalized.eventId;
    const existing = await WebhookEvent.findOne({ provider: 'plaid', eventId }).lean();
    if (existing?.processedAt) {
      return NextResponse.json({ success: true, data: { idempotent: true, action: normalized.action } });
    }
    if (!existing) {
      await WebhookEvent.create({
        provider: 'plaid',
        eventId,
        eventType: normalized.type || '',
        receivedAt: new Date(),
        raw: event,
      });
    }

    // Trigger an immediate sync on SYNC_UPDATES_AVAILABLE; otherwise
    // just stamp and ack. The hourly cron picks up the rest.
    if (normalized.action === 'sync_now' && normalized.providerAccountId) {
      // Lazy-require to avoid the heavier dep graph for non-sync events.
      // eslint-disable-next-line global-require
      const { BankConnection } = require('@/lib/models/BankConnection');
      // eslint-disable-next-line global-require
      const sync = require('@/lib/services/bank/sync.service');
      const conn = await BankConnection.findOne({
        provider: 'plaid',
        providerAccountId: normalized.providerAccountId,
        status: 'active',
      });
      if (conn) {
        sync.syncConnection(conn._id).catch((err) =>
          logger.warn('plaid webhook-triggered sync failed', { message: err.message })
        );
      }
    }

    await WebhookEvent.updateOne(
      { provider: 'plaid', eventId },
      { $set: { processedAt: new Date() } }
    );

    return NextResponse.json({ success: true, data: { action: normalized.action } });
  } catch (err) {
    logger.error('plaid webhook failed', { message: err.message, stack: err.stack });
    return fail(500, 'INTERNAL_ERROR', err.message);
  }
};

exports.POST = handler;
