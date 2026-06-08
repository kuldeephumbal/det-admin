// Object storage router.
//
// Two backends:
//   - local — writes to ./var/uploads/<userId>/<key>. Dev default.
//   - r2    — Cloudflare R2 / S3-compatible (per plan §17 recommendation).
//
// Adapter interface:
//   put({ key, buffer, contentType, userId }) → { url, key }
//   get(key) → { stream, contentType }   (used by signed-URL endpoints)
//   delete(key) → void
//   isConfigured() → bool
//
// Selection is env-driven (`STORAGE_PROVIDER`); defaults to 'local'.

const env = require('../../config/env');
const local = require('./local');
const r2 = require('./r2');

const ADAPTERS = { local, r2 };

const get = () => {
  const name = env.STORAGE_PROVIDER || 'local';
  const adapter = ADAPTERS[name];
  if (!adapter) throw new Error(`Unknown STORAGE_PROVIDER: ${name}`);
  return adapter;
};

module.exports = { get };
