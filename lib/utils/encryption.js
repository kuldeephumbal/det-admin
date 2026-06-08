// AES-256-GCM encryption helper for bank tokens at rest.
//
// Used by BankConnection.accessTokenEncrypted (and any other field
// we don't want a DB compromise to read in cleartext). The key comes
// from `env.BANK_TOKEN_ENC_KEY` — must be a 32-byte secret encoded as
// base64. Rotate via env + a re-encrypt migration; never check it
// into source.
//
// Output format: `${ivBase64}:${tagBase64}:${cipherBase64}` (all
// concatenated). On the wire / in DB it's a single string the model
// stores opaquely.

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // GCM standard
const KEY_BYTES = 32; // AES-256

const _loadKey = (raw) => {
  if (!raw) {
    throw new Error('BANK_TOKEN_ENC_KEY not set');
  }
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== KEY_BYTES) {
    throw new Error(
      `BANK_TOKEN_ENC_KEY must be ${KEY_BYTES} bytes (base64-encoded); got ${buf.length}`
    );
  }
  return buf;
};

const encrypt = (plaintext, keyBase64) => {
  const key = _loadKey(keyBase64);
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(':');
};

const decrypt = (envelope, keyBase64) => {
  const key = _loadKey(keyBase64);
  const parts = envelope.split(':');
  if (parts.length !== 3) throw new Error('Malformed encryption envelope');
  const [ivB64, tagB64, cipherB64] = parts;
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(cipherB64, 'base64')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
};

// Generate a fresh 32-byte key. Useful in dev / scripts for bootstrap.
const newKeyBase64 = () => crypto.randomBytes(KEY_BYTES).toString('base64');

module.exports = { encrypt, decrypt, newKeyBase64 };
