// Local filesystem storage adapter (dev only).
//
// Writes uploads under ./var/uploads/<userId>/<key>. The `url` returned
// is a relative API path (`/api/v1/receipts/file/<receiptId>`) so the
// mobile client can re-fetch via an authenticated route — never serve
// these files as static assets, since receipts contain PII.

const fs = require('fs/promises');
const path = require('path');

const ROOT = path.resolve(process.cwd(), 'var', 'uploads');

const isConfigured = () => true; // always works

const _safeKey = (key) => {
  // Defense in depth — keys come from server-generated UUIDs already,
  // but reject anything containing path-traversal sequences.
  if (/\.\.|[/\\]/.test(key)) throw new Error('Invalid storage key');
  return key;
};

const put = async ({ key, buffer, userId }) => {
  const safe = _safeKey(key);
  const dir = path.join(ROOT, String(userId));
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, safe);
  await fs.writeFile(filePath, buffer);
  return {
    key: safe,
    url: `/api/v1/receipts/file/${safe}`,
  };
};

const get = async (key, userId) => {
  const safe = _safeKey(key);
  const filePath = path.join(ROOT, String(userId), safe);
  const buffer = await fs.readFile(filePath);
  return { buffer };
};

const del = async (key, userId) => {
  const safe = _safeKey(key);
  const filePath = path.join(ROOT, String(userId), safe);
  await fs.unlink(filePath).catch((err) => {
    if (err.code !== 'ENOENT') throw err;
  });
};

module.exports = { isConfigured, put, get, delete: del };
