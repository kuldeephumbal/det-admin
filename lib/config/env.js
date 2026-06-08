// Next.js auto-loads .env.local / .env. Read once and freeze.
const required = (key, fallback) => {
  const v = process.env[key] ?? fallback;
  if (v === undefined || v === null || v === '') {
    throw new Error(`Missing required env var: ${key}`);
  }
  return v;
};

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',

  MONGO_URI: required('MONGO_URI', 'mongodb://127.0.0.1:27017/det'),

  JWT_ACCESS_SECRET: required('JWT_ACCESS_SECRET', 'dev_access_secret_change_me'),
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  JWT_REFRESH_SECRET: required('JWT_REFRESH_SECRET', 'dev_refresh_secret_change_me'),
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  RESET_TOKEN_EXPIRES_IN: process.env.RESET_TOKEN_EXPIRES_IN || '15m',
  EMAIL_VERIFICATION_TOKEN_TTL: process.env.EMAIL_VERIFICATION_TOKEN_TTL || '24h',
  EMAIL_VERIFICATION_RESEND_COOLDOWN_MS: parseInt(
    process.env.EMAIL_VERIFICATION_RESEND_COOLDOWN_MS || '60000',
    10
  ),

  // Google Sign-In. When unset, /api/v1/auth/google returns 503 and the
  // mobile "Continue with Google" button hides itself. Set this to the
  // Web client ID from your Google Cloud project (NOT the Android /
  // iOS-specific client IDs — those go in google-services.json /
  // GoogleService-Info.plist on the mobile side).
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',

  BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),

  CORS_ORIGINS: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '300', 10),

  LOG_LEVEL: process.env.LOG_LEVEL || 'info',

  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  MAIL_FROM: process.env.MAIL_FROM || 'DET <no-reply@det.app>',

  // Optional dedicated key for at-rest encryption of secrets stored in
  // the AppSetting collection (SMTP password, future API keys). Must
  // be 32 bytes base64. When unset, lib/services/settings.service.js
  // derives one from JWT_ACCESS_SECRET — good enough for dev, but
  // rotate to a real key before treating SMTP-via-DB as production-grade.
  APP_SECRETS_ENC_KEY: process.env.APP_SECRETS_ENC_KEY || '',

  // Secret required by /api/cron/* triggers. Falls back to a dev-only value;
  // production deploys MUST set this.
  CRON_SECRET: process.env.CRON_SECRET || 'dev_cron_secret_change_me',

  // Firebase Cloud Messaging. The credentials JSON is base64-encoded so it
  // fits in a single env var without quoting hell. Both blank by default —
  // when unset, fcm.service.js silently no-ops (mirrors the mailer pattern)
  // so dev / test environments don't need a real Firebase project.
  FCM_CREDENTIALS_JSON: process.env.FCM_CREDENTIALS_JSON || '',
  FCM_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || process.env.FCM_PROJECT_ID || '',
  // Per-user soft cap on stored devices. Older entries are LRU-evicted on
  // a fresh /devices register to bound fan-out.
  FCM_MAX_DEVICES_PER_USER: parseInt(process.env.FCM_MAX_DEVICES_PER_USER || '10', 10),

  // Billing — all provider creds blank by default. Each adapter falls
  // back to a "not configured" error when called without its secret set,
  // mirroring the FCM/mailer pattern: dev environments stay functional,
  // production deploys MUST set them before the paywall ships.
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
  GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON || '',
  GOOGLE_PLAY_PACKAGE_NAME: process.env.GOOGLE_PLAY_PACKAGE_NAME || '',
  GOOGLE_PLAY_PUBSUB_AUDIENCE: process.env.GOOGLE_PLAY_PUBSUB_AUDIENCE || '',
  APPLE_SHARED_SECRET: process.env.APPLE_SHARED_SECRET || '',
  APPLE_BUNDLE_ID: process.env.APPLE_BUNDLE_ID || '',

  // Receipt OCR + object storage. Storage defaults to local FS (dev);
  // production should set STORAGE_PROVIDER=r2 and the R2_* credentials.
  // OCR defaults to 'vision' (Google Cloud Vision); the worker stamps
  // each scan as `failed` with code 'OCR_NOT_CONFIGURED' until the
  // credentials env is populated.
  STORAGE_PROVIDER: process.env.STORAGE_PROVIDER || 'local',
  R2_ENDPOINT: process.env.R2_ENDPOINT || '',
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || '',
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || '',
  R2_BUCKET_RECEIPTS: process.env.R2_BUCKET_RECEIPTS || '',

  OCR_PROVIDER: process.env.OCR_PROVIDER || 'vision',
  GOOGLE_VISION_CREDENTIALS_JSON: process.env.GOOGLE_VISION_CREDENTIALS_JSON || '',

  // Anthropic LLM (used by AI Insights). Blank by default — the
  // insights pipeline falls back to canned narrations when missing
  // so the feature is still observably alive without burning tokens.
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
  // Per-user daily insight-regenerate cap (LLM cost guard).
  INSIGHT_REGENERATE_DAILY_CAP: parseInt(process.env.INSIGHT_REGENERATE_DAILY_CAP || '3', 10),

  // Bank Sync. Token encryption key MUST be set in any deployment
  // that turns bank features on — adapters refuse to encrypt without
  // it. Base64, 32-byte key. Provider creds default to blank;
  // adapters throw BANK_NOT_CONFIGURED until populated.
  BANK_TOKEN_ENC_KEY: process.env.BANK_TOKEN_ENC_KEY || '',
  BANK_PROVIDER_DEFAULT: process.env.BANK_PROVIDER_DEFAULT || 'plaid',
  PLAID_CLIENT_ID: process.env.PLAID_CLIENT_ID || '',
  PLAID_SECRET: process.env.PLAID_SECRET || '',
  PLAID_ENV: process.env.PLAID_ENV || 'sandbox',
  PLAID_WEBHOOK_SECRET: process.env.PLAID_WEBHOOK_SECRET || '',
  SETU_CLIENT_ID: process.env.SETU_CLIENT_ID || '',
  SETU_SECRET: process.env.SETU_SECRET || '',
  SETU_WEBHOOK_SECRET: process.env.SETU_WEBHOOK_SECRET || '',

  // Grace window before downgrading a failed-renewal subscription.
  SUBSCRIPTION_GRACE_DAYS: parseInt(process.env.SUBSCRIPTION_GRACE_DAYS || '3', 10),
  // Renewal reminders fire T-N days before currentPeriodEnd.
  SUBSCRIPTION_REMINDER_DAYS_AHEAD: (process.env.SUBSCRIPTION_REMINDER_DAYS_AHEAD || '7,3,1')
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0),
};

module.exports = env;
