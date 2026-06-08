// Runtime-editable settings store.
//
// Each setting lives in the AppSetting collection under a stable key
// (`smtp`, `fcm`, etc.). The admin panel writes here, and downstream
// services read through these accessors with the env vars as a
// fallback — so a fresh deploy with no DB rows behaves exactly like
// the env-only setup we had before.
//
// Secrets (SMTP password today, more later) are encrypted at rest with
// AES-256-GCM using a key derived from JWT_ACCESS_SECRET so we don't
// require yet another env var for dev / first-run. Operators who want
// a dedicated key can set APP_SECRETS_ENC_KEY (32 bytes, base64).
//
// On read, secrets are NEVER returned in plaintext to the API layer —
// only `passwordSet: true/false` plus a masked-last-4 hint.

const crypto = require('crypto');
const AppSetting = require('../models/AppSetting');
const env = require('../config/env');
const encryption = require('../utils/encryption');
const logger = require('../utils/logger');

const _derivedKey = () => {
  // 32 bytes from SHA-256 of the JWT secret — deterministic across
  // restarts but per-deployment. Sufficient for at-rest encryption
  // when no dedicated key is provided.
  return crypto.createHash('sha256').update(String(env.JWT_ACCESS_SECRET)).digest('base64');
};

const _encKey = () => env.APP_SECRETS_ENC_KEY || _derivedKey();

const _encryptSecret = (plaintext) => {
  if (!plaintext) return '';
  return encryption.encrypt(plaintext, _encKey());
};

const _decryptSecret = (envelope) => {
  if (!envelope) return '';
  try {
    return encryption.decrypt(envelope, _encKey());
  } catch (err) {
    // Most common cause: the encryption key changed since the row was
    // written. Treat as "no value set" rather than crashing — the
    // admin UI surfaces this as "needs reconfigure".
    logger.warn('settings.decrypt failed; treating as unset', { message: err.message });
    return '';
  }
};

// ---------- SMTP ----------

const SMTP_KEY = 'smtp';

// Effective SMTP config: DB row first, falling back to env per-field.
// Used by the mailer at transport init time.
const getSmtpEffective = async () => {
  let row = null;
  try {
    row = await AppSetting.findOne({ key: SMTP_KEY }).lean();
  } catch (_) {
    // DB unavailable — fall through to env-only.
  }
  const stored = row?.value || {};
  const passwordEncrypted = stored.passwordEncrypted || '';
  return {
    host: stored.host || env.SMTP_HOST || '',
    port: Number.isFinite(stored.port) ? stored.port : env.SMTP_PORT,
    user: stored.user || env.SMTP_USER || '',
    pass: passwordEncrypted ? _decryptSecret(passwordEncrypted) : env.SMTP_PASS || '',
    from: stored.from || env.MAIL_FROM || '',
    source: row ? 'db' : 'env',
  };
};

// Admin-facing read. Never returns the password — only a flag plus a
// 2-char hint so the UI can render "•••• xx".
const getSmtpForAdmin = async () => {
  const eff = await getSmtpEffective();
  const stored = (await AppSetting.findOne({ key: SMTP_KEY }).lean())?.value || {};

  const hasDbPassword = Boolean(stored.passwordEncrypted);
  const hasEnvPassword = Boolean(env.SMTP_PASS);
  const passwordSet = hasDbPassword || hasEnvPassword;
  const passwordHint = passwordSet
    ? hasDbPassword
      ? '•••• (saved)'
      : `••••${env.SMTP_PASS.length > 2 ? env.SMTP_PASS.slice(-2) : ''}`
    : '';

  return {
    host: eff.host,
    port: eff.port,
    user: eff.user,
    from: eff.from,
    passwordSet,
    passwordHint,
    source: eff.source,
    envFallback: {
      host: env.SMTP_HOST || '',
      port: env.SMTP_PORT,
      user: env.SMTP_USER || '',
      from: env.MAIL_FROM || '',
      passwordSet: Boolean(env.SMTP_PASS),
    },
  };
};

// Write-side. `password` is optional — if omitted, the existing
// encrypted blob is kept (so admins can change host/port/user without
// retyping the password).
const updateSmtp = async ({ host, port, user, password, from }, actor) => {
  const existing = await AppSetting.findOne({ key: SMTP_KEY });
  const existingPwd = existing?.value?.passwordEncrypted || '';

  const value = {
    host: (host || '').trim(),
    port: Number.isFinite(port) ? port : 587,
    user: (user || '').trim(),
    from: (from || '').trim(),
    passwordEncrypted:
      typeof password === 'string' && password.length > 0
        ? _encryptSecret(password)
        : existingPwd,
  };

  await AppSetting.findOneAndUpdate(
    { key: SMTP_KEY },
    {
      $set: {
        key: SMTP_KEY,
        value,
        updatedBy: actor
          ? { _id: actor.id, email: actor.email, name: actor.doc?.name || '' }
          : null,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Bust the mailer's cached transporter so the next sendMail() picks
  // up the new credentials.
  try {
    require('../utils/mailer').invalidateTransporter();
  } catch (_) {
    // Mailer hasn't been loaded yet — nothing to bust.
  }

  return getSmtpForAdmin();
};

const clearSmtp = async () => {
  await AppSetting.deleteOne({ key: SMTP_KEY });
  try {
    require('../utils/mailer').invalidateTransporter();
  } catch (_) {}
  return getSmtpForAdmin();
};

module.exports = {
  getSmtpEffective,
  getSmtpForAdmin,
  updateSmtp,
  clearSmtp,
};
