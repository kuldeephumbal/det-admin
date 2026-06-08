// In-memory rate limiter, keyed by IP + bucket name. Suitable for dev
// and single-instance deploys. For multi-region / serverless, swap
// the storage for Upstash Redis (drop-in replacement) in Phase 10.

const env = require('../config/env');
const ApiError = require('../utils/ApiError');

const BUCKETS_KEY = '__det_ratelimit__';
let store = global[BUCKETS_KEY];
if (!store) {
  store = global[BUCKETS_KEY] = new Map();
}

const sweepIfNeeded = () => {
  if (store.size < 10_000) return;
  const now = Date.now();
  for (const [k, entry] of store.entries()) {
    if (entry.resetAt <= now) store.delete(k);
  }
};

const hit = (key, { windowMs, max }) => {
  const now = Date.now();
  let entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    store.set(key, entry);
  }
  entry.count += 1;
  sweepIfNeeded();
  const remaining = Math.max(0, max - entry.count);
  return {
    allowed: entry.count <= max,
    remaining,
    resetAt: entry.resetAt,
  };
};

const checkRateLimit = (req, { bucket = 'api', windowMs, max } = {}) => {
  const w = windowMs ?? env.RATE_LIMIT_WINDOW_MS;
  const m = max ?? env.RATE_LIMIT_MAX;
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';
  const result = hit(`${bucket}:${ip}`, { windowMs: w, max: m });
  if (!result.allowed) {
    const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
    throw new ApiError(429, 'Too many requests, please slow down', {
      details: { retryAfter },
    });
  }
  return result;
};

module.exports = { checkRateLimit };
