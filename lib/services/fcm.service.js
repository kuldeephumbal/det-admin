// Firebase Cloud Messaging adapter.
//
// Design parallels lib/utils/mailer.js:
//   - `firebase-admin` is an optionalDependency. When it isn't installed or
//     when FCM_CREDENTIALS_JSON is blank, every public method becomes a
//     non-throwing no-op that logs. Tests + local dev never need a real
//     Firebase project.
//   - All errors here are operational. Push fan-out must NEVER make a
//     successful business write (a budget alert, a broadcast, etc.) look
//     like a failure to the caller — `notification.service.dispatch` calls
//     us *after* it persists the in-app row.
//
// Public surface:
//   - sendToTokens(tokens, payload) → { successCount, failureCount, invalidTokens }
//   - pruneInvalidTokens(userId, tokens) → number of devices deactivated
//   - isConfigured() → boolean (truthy creds + truthy SDK)

const env = require('../config/env');
const logger = require('../utils/logger');
const Device = require('../models/Device');

// Lazy singletons.
let adminSdkPromise = null;
let messagingPromise = null;

// Hide the optional dep require from webpack's static analyser so the
// build doesn't fail when `firebase-admin` isn't installed. Same pattern
// used for `googleapis` in lib/services/billing/google.js — webpack
// doesn't see through eval, so it stays a true runtime require.
const _requireFirebaseAdmin = () => {
  // eslint-disable-next-line no-eval
  const nodeRequire = eval('require');
  return nodeRequire('firebase-admin');
};

const _loadSdk = async () => {
  if (!env.FCM_CREDENTIALS_JSON) return null;
  try {
    const admin = _requireFirebaseAdmin();
    if (!admin.apps.length) {
      let serviceAccount;
      try {
        serviceAccount = JSON.parse(
          Buffer.from(env.FCM_CREDENTIALS_JSON, 'base64').toString('utf8')
        );
      } catch (err) {
        logger.error('fcm: FCM_CREDENTIALS_JSON is not valid base64-encoded JSON', {
          message: err.message,
        });
        return null;
      }
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: env.FCM_PROJECT_ID || serviceAccount.project_id,
      });
    }
    return admin;
  } catch (err) {
    // Optional dep not installed — that's fine, we run in no-op mode.
    if (err && err.code === 'MODULE_NOT_FOUND') {
      logger.info('fcm: firebase-admin not installed — push delivery disabled');
      return null;
    }
    logger.error('fcm: failed to initialize firebase-admin', { message: err.message });
    return null;
  }
};

const _getMessaging = async () => {
  if (messagingPromise) return messagingPromise;
  if (!adminSdkPromise) adminSdkPromise = _loadSdk();
  const admin = await adminSdkPromise;
  if (!admin) return null;
  messagingPromise = Promise.resolve(admin.messaging());
  return messagingPromise;
};

const isConfigured = () => Boolean(env.FCM_CREDENTIALS_JSON);

// FCM API accepts ≤ 500 tokens per multicast. Larger batches must be split.
const _chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

// Codes returned by FCM that mean "this token is dead, deactivate it".
// Anything else (server error, timeout) is transient — we keep the token
// and let the next dispatch retry.
const PERMANENT_ERRORS = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

// payload: { title, body, data?, deepLink? }
const sendToTokens = async (tokens, payload) => {
  const cleanTokens = (tokens || []).filter(Boolean);
  if (cleanTokens.length === 0) {
    return { successCount: 0, failureCount: 0, invalidTokens: [], skipped: 'no_tokens' };
  }

  const messaging = await _getMessaging();
  if (!messaging) {
    logger.info('[fcm:dev] Push skipped — SDK not configured', {
      tokenCount: cleanTokens.length,
      title: payload?.title,
    });
    return { successCount: 0, failureCount: 0, invalidTokens: [], skipped: 'not_configured' };
  }

  // FCM data values must all be strings. Stringify numbers/objects defensively.
  const dataPayload = {};
  for (const [k, v] of Object.entries(payload.data || {})) {
    if (v === undefined || v === null) continue;
    dataPayload[k] = typeof v === 'string' ? v : JSON.stringify(v);
  }
  if (payload.deepLink) dataPayload.deepLink = payload.deepLink;

  // High-priority Android payload — bypasses Doze-mode delivery delays
  // and tells the OS exactly which channel to route through (matches
  // the default_notification_channel_id declared in AndroidManifest).
  // Without these, OEMs like Xiaomi / Realme / Oppo will silently
  // demote or drop the message even when FCM returns successCount=1.
  const message = {
    notification: {
      title: payload.title || '',
      body: payload.body || '',
    },
    data: dataPayload,
    android: {
      priority: 'high',
      notification: {
        channelId: 'det_default_channel',
        sound: 'default',
        defaultSound: true,
        defaultVibrateTimings: true,
        visibility: 'public',
      },
    },
    apns: {
      payload: {
        aps: { sound: 'default' },
      },
    },
  };

  let successCount = 0;
  let failureCount = 0;
  const invalidTokens = [];
  let lastError = '';

  for (const batch of _chunk(cleanTokens, 500)) {
    try {
      const resp = await messaging.sendEachForMulticast({ tokens: batch, ...message });
      successCount += resp.successCount;
      failureCount += resp.failureCount;
      resp.responses.forEach((r, i) => {
        if (!r.success) {
          const code = r.error?.code || '';
          if (PERMANENT_ERRORS.has(code)) invalidTokens.push(batch[i]);
          lastError = code || r.error?.message || lastError;
        }
      });
    } catch (err) {
      failureCount += batch.length;
      lastError = err.message || String(err);
      logger.error('fcm: multicast batch threw', { message: err.message });
    }
  }

  return { successCount, failureCount, invalidTokens, lastError };
};

// Deactivate dead tokens so future dispatches don't waste a slot on them.
// Returns number of Device rows touched.
const pruneInvalidTokens = async (userId, tokens) => {
  if (!tokens || tokens.length === 0) return 0;
  const r = await Device.updateMany(
    { user: userId, fcmToken: { $in: tokens } },
    { $set: { isActive: false, revokedAt: new Date() }, $unset: { fcmToken: '' } }
  );
  return r.modifiedCount || 0;
};

// Test-only: drop the SDK singletons so a unit test can re-init with a
// freshly-mocked module. Never call from production code.
const __resetForTests = () => {
  adminSdkPromise = null;
  messagingPromise = null;
};

module.exports = { sendToTokens, pruneInvalidTokens, isConfigured, __resetForTests };
