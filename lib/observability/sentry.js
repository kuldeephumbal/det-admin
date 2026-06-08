// Optional Sentry integration. Stays a no-op when SENTRY_DSN is unset, so
// dev/CI environments never need the SDK installed.
//
// Production deploys: add `@sentry/node` to dependencies (or `@sentry/nextjs`
// for richer Next.js framework hooks), set SENTRY_DSN in env, and this
// module's `initSentry()` will take over.

const logger = require('../utils/logger');

let initialized = false;
let sentry = null;

const initSentry = () => {
  if (initialized) return sentry;
  initialized = true;

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return null;

  try {
    // eslint-disable-next-line global-require
    sentry = require('@sentry/node');
    sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.APP_RELEASE || undefined,
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.05'),
    });
    logger.info('Sentry initialized');
  } catch (err) {
    logger.warn('SENTRY_DSN set but @sentry/node is not installed; skipping init', {
      message: err.message,
    });
    sentry = null;
  }
  return sentry;
};

const captureException = (err, context) => {
  if (!sentry) return;
  try {
    sentry.captureException(err, { extra: context });
  } catch (_) {
    // Never let observability throw.
  }
};

const captureMessage = (msg, level = 'info', context) => {
  if (!sentry) return;
  try {
    sentry.captureMessage(msg, { level, extra: context });
  } catch (_) {
    // ignore
  }
};

module.exports = { initSentry, captureException, captureMessage };
