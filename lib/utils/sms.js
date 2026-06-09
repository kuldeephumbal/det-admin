// Lightweight SMS helper, mirroring lib/utils/mailer.js.
//
// Reads Twilio config from env. When credentials are absent, the message
// is written to the logger and `{ delivered: false }` is returned —
// dev-friendly and NEVER throws, so the invite flow is never blocked by
// SMS not being configured. `twilio` is loaded lazily (optional dep) and
// only required when credentials are present, so an uninstalled twilio
// package can't crash the unconfigured path.

const logger = require('./logger');

let _client = null;
let _sig = '';

const _config = () => ({
  sid: process.env.TWILIO_ACCOUNT_SID || '',
  token: process.env.TWILIO_AUTH_TOKEN || '',
  from: process.env.TWILIO_FROM || '',
});

const isConfigured = () => {
  const c = _config();
  return Boolean(c.sid && c.token && c.from);
};

const _getClient = () => {
  const c = _config();
  if (!c.sid || !c.token || !c.from) return null;
  const sig = `${c.sid}|${c.from}`;
  if (_client && _sig === sig) return _client;
  const twilio = require('twilio'); // optional dep — only reached when configured
  _client = twilio(c.sid, c.token);
  _sig = sig;
  return _client;
};

const sendSms = async ({ to, body }) => {
  const client = _getClient();
  const c = _config();
  if (!client) {
    logger.info('[sms:dev] SMS not sent — Twilio not configured', { to, body });
    return { delivered: false, reason: 'sms_not_configured' };
  }
  try {
    const msg = await client.messages.create({ to, from: c.from, body });
    logger.info('[sms] sent', { to, sid: msg.sid });
    return { delivered: true, sid: msg.sid };
  } catch (e) {
    // Swallow — a failed SMS must not fail the invite. Surfaced in logs.
    logger.warn('[sms] send failed', { to, message: e.message });
    return { delivered: false, reason: 'sms_send_failed', error: e.message };
  }
};

module.exports = { sendSms, isConfigured };
