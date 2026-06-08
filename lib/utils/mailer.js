// Lightweight mail helper.
//
// Reads its config from the runtime settings store first (so admins
// can edit SMTP from the admin panel), with env vars as the fallback.
// When neither path yields a usable host/user/pass tuple, emails are
// written to the logger — dev-friendly, but `delivered: false` so
// callers know the message didn't actually leave the box.
//
// nodemailer is loaded lazily so the dependency stays optional.

const env = require('../config/env');
const logger = require('./logger');

let _cachedEffective = null;
let _cachedTransporter = null;
let _cachedSig = '';

const _loadEffective = async () => {
  // `settings.service` imports this file transitively for the
  // invalidation hook, so require it lazily to avoid a cycle.
  try {
    const settings = require('../services/settings.service');
    return settings.getSmtpEffective();
  } catch (_) {
    return {
      host: env.SMTP_HOST || '',
      port: env.SMTP_PORT,
      user: env.SMTP_USER || '',
      pass: env.SMTP_PASS || '',
      from: env.MAIL_FROM || '',
      source: 'env',
    };
  }
};

const _sig = (eff) =>
  [eff.host, eff.port, eff.user, eff.pass ? eff.pass.length : 0, eff.from].join('|');

const isConfigured = async () => {
  const eff = await _loadEffective();
  return Boolean(eff.host && eff.user && eff.pass);
};

const getTransporter = async () => {
  const eff = await _loadEffective();
  if (!eff.host || !eff.user || !eff.pass) return null;

  const sig = _sig(eff);
  if (_cachedTransporter && _cachedSig === sig) return _cachedTransporter;

  // Config changed (or first init) — build a fresh transporter.
  const nodemailer = require('nodemailer'); // optional dep
  _cachedTransporter = nodemailer.createTransport({
    host: eff.host,
    port: eff.port,
    secure: eff.port === 465,
    auth: { user: eff.user, pass: eff.pass },
  });
  _cachedSig = sig;
  _cachedEffective = eff;
  return _cachedTransporter;
};

// Called by settings.service.updateSmtp after writing a new config so
// the next sendMail() reconnects with the new credentials instead of
// reusing the stale transporter.
const invalidateTransporter = () => {
  _cachedTransporter = null;
  _cachedSig = '';
  _cachedEffective = null;
};

const _fromFor = async () => (_cachedEffective?.from) || (await _loadEffective()).from;

const sendMail = async ({ to, subject, text, html }) => {
  const transporter = await getTransporter();
  const from = await _fromFor();

  if (!transporter) {
    logger.info('[mailer:dev] Email not sent — SMTP not configured', { to, subject, text });
    return { delivered: false, reason: 'smtp_not_configured' };
  }

  const info = await transporter.sendMail({ from, to, subject, text, html });
  logger.info('[mailer] sent', { to, subject, messageId: info.messageId });
  return { delivered: true, messageId: info.messageId };
};

const sendPasswordResetEmail = ({ to, name, resetUrl, expiresInMinutes }) => {
  const subject = 'Reset your DET password';
  const text = `Hi ${name || ''},

We received a request to reset your DET account password. Click the link below to choose a new password:

${resetUrl}

This link will expire in ${expiresInMinutes} minutes. If you didn't request this, you can safely ignore this email.

— DET`;
  const html = `<p>Hi ${name || ''},</p>
<p>We received a request to reset your DET account password.</p>
<p><a href="${resetUrl}" style="display:inline-block;padding:10px 16px;background:#111827;color:#fff;border-radius:8px;text-decoration:none;">Reset password</a></p>
<p>This link will expire in <strong>${expiresInMinutes} minutes</strong>. If you didn't request this, you can safely ignore this email.</p>
<p>— DET</p>`;
  return sendMail({ to, subject, text, html });
};

const sendVerificationEmail = ({ to, name, verifyUrl, expiresInHours }) => {
  const subject = 'Verify your DET email address';
  const text = `Hi ${name || ''},

Welcome to DET! Please verify your email address by clicking the link below:

${verifyUrl}

This link will expire in ${expiresInHours} hours. If you didn't sign up for DET, you can safely ignore this email.

— DET`;
  const html = `<p>Hi ${name || ''},</p>
<p>Welcome to DET! Please verify your email address to unlock the full app.</p>
<p><a href="${verifyUrl}" style="display:inline-block;padding:10px 16px;background:#111827;color:#fff;border-radius:8px;text-decoration:none;">Verify email</a></p>
<p>This link will expire in <strong>${expiresInHours} hours</strong>. If you didn't sign up for DET, you can safely ignore this email.</p>
<p>— DET</p>`;
  return sendMail({ to, subject, text, html });
};

const sendMagicLinkEmail = ({ to, name, signInUrl, fallbackUrl, expiresInMinutes }) => {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const subject = 'Your DET sign-in link';
  const text = `${greeting}

Tap the link below on the phone where the DET app is installed:

${signInUrl}

If the link above doesn't do anything when you tap it, copy this
backup link into your phone's Chrome address bar instead:

${fallbackUrl || signInUrl}

The link opens DET and signs you in — no password required. It works
once and expires in ${expiresInMinutes} minutes.

— DET`;
  // Primary button uses the intent:// URL (works in most Gmail Android
  // builds when the `S.browser_fallback_url` directive is present).
  // The secondary plain det:// link below is a copy-paste fallback for
  // mail clients that refuse to render intent:// as clickable.
  const html = `<p>${greeting}</p>
<p>Tap the button below on the phone where the DET app is installed. It'll open DET and sign you in automatically.</p>
<p><a href="${signInUrl}" style="display:inline-block;padding:12px 20px;background:#5B7CFA;color:#fff;border-radius:10px;text-decoration:none;font-weight:600;">Open DET to sign in</a></p>
${fallbackUrl ? `
<p style="color:#6B7280;font-size:13px;">If tapping the button doesn't open the app, copy this link into your phone's Chrome address bar:</p>
<p style="background:#F3F4F6;padding:10px 12px;border-radius:8px;font-family:monospace;font-size:12px;word-break:break-all;color:#111827;">${fallbackUrl}</p>
` : ''}
<p style="color:#6B7280;font-size:13px;">This link works once and expires in <strong>${expiresInMinutes} minutes</strong>. If you didn't request it, you can safely ignore this email.</p>
<p>— DET</p>`;
  return sendMail({ to, subject, text, html });
};

module.exports = {
  sendMail,
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendMagicLinkEmail,
  isConfigured,
  invalidateTransporter,
};
