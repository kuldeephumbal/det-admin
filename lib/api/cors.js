// CORS support for cross-origin clients (the Flutter app, any web client).
// Used by the helpers in `withRoute.js` and by Next.js middleware.ts.

const env = require('../config/env');

const ALLOW_ALL = env.CORS_ORIGINS.includes('*');

const resolveOrigin = (reqOrigin) => {
  if (ALLOW_ALL) return '*';
  if (reqOrigin && env.CORS_ORIGINS.includes(reqOrigin)) return reqOrigin;
  return env.CORS_ORIGINS[0] || '*';
};

const buildCorsHeaders = (reqOrigin) => ({
  'Access-Control-Allow-Origin': resolveOrigin(reqOrigin),
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': ALLOW_ALL ? 'false' : 'true',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
});

module.exports = { buildCorsHeaders, resolveOrigin };
