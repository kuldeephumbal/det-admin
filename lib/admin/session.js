// Helpers for the admin httpOnly cookie session.
//   - signAdminSession(userId) — returns the JWT string
//   - cookieOptions(env) — Set-Cookie attributes used everywhere we set it
//   - sessionCookieName — single source of truth for the cookie name

const jwt = require('jsonwebtoken');
const env = require('../config/env');

const sessionCookieName = 'det.admin';
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

const signAdminSession = (user) =>
  jwt.sign(
    { sub: String(user._id), role: user.role, aud: 'admin' },
    env.JWT_ACCESS_SECRET,
    { expiresIn: SESSION_TTL_SECONDS }
  );

const verifyAdminSession = (token) => {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, { audience: 'admin' });
  if (decoded.role !== 'admin') {
    const err = new Error('Not an admin token');
    err.name = 'JsonWebTokenError';
    throw err;
  }
  return decoded;
};

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'strict',
  secure: env.NODE_ENV === 'production',
  path: '/',
  maxAge: SESSION_TTL_SECONDS,
});

const clearedCookieOptions = () => ({
  httpOnly: true,
  sameSite: 'strict',
  secure: env.NODE_ENV === 'production',
  path: '/',
  maxAge: 0,
});

module.exports = {
  sessionCookieName,
  SESSION_TTL_SECONDS,
  signAdminSession,
  verifyAdminSession,
  cookieOptions,
  clearedCookieOptions,
};
