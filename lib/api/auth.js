const ApiError = require('../utils/ApiError');
const { verifyAccessToken } = require('../utils/jwt');
const { verifyAdminSession, sessionCookieName } = require('../admin/session');
const { USER_STATUS } = require('../config/constants');
const User = require('../models/User');

const extractBearer = (req) => {
  const header = req.headers.get('authorization') || req.headers.get('Authorization');
  if (header && header.startsWith('Bearer ')) return header.slice(7);
  return null;
};

const extractAdminCookie = (req) => {
  // NextRequest exposes typed cookies; plain Request does not. Both surface
  // raw cookies in the Cookie header — fall back if needed.
  if (req.cookies?.get) {
    const v = req.cookies.get(sessionCookieName)?.value;
    if (v) return v;
  }
  const raw = req.headers.get('cookie') || '';
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === sessionCookieName) return decodeURIComponent(rest.join('='));
  }
  return null;
};

const loadUser = async (userId) => {
  const user = await User.findById(userId).select('+status');
  if (!user) throw ApiError.unauthorized('User no longer exists');
  if (user.status !== USER_STATUS.ACTIVE) throw ApiError.forbidden(`Account ${user.status}`);
  return user;
};

// Returns { id, role, email, doc } or throws ApiError.
//
// Order of resolution:
//   1. Bearer access token (used by mobile + any other API client)
//   2. Admin session cookie (used by the admin panel pages talking
//      to /api/v1/admin/* from a same-origin Client Component)
const requireAuth = async (req) => {
  const bearer = extractBearer(req);
  if (bearer) {
    let decoded;
    try {
      decoded = verifyAccessToken(bearer);
    } catch (err) {
      if (err.name === 'TokenExpiredError') throw ApiError.unauthorized('Token expired');
      throw ApiError.unauthorized('Invalid token');
    }
    const user = await loadUser(decoded.sub);
    return {
      id: String(user._id),
      role: user.role,
      email: user.email,
      doc: user,
      via: 'bearer',
    };
  }

  const cookie = extractAdminCookie(req);
  if (cookie) {
    let decoded;
    try {
      decoded = verifyAdminSession(cookie);
    } catch (err) {
      if (err.name === 'TokenExpiredError') throw ApiError.unauthorized('Session expired');
      throw ApiError.unauthorized('Invalid session');
    }
    const user = await loadUser(decoded.sub);
    if (user.role !== 'admin') throw ApiError.forbidden('Not an admin');
    return {
      id: String(user._id),
      role: user.role,
      email: user.email,
      doc: user,
      via: 'cookie',
    };
  }

  throw ApiError.unauthorized('Missing access token');
};

const requireRole = (auth, ...roles) => {
  if (!roles.includes(auth.role)) throw ApiError.forbidden('Insufficient permissions');
  return auth;
};

// Plan gate. Premium-only routes call this after `requireAuth` (or set
// `requirePlan: 'premium'` on withRoute) to deny callers whose user.plan
// doesn't match — or whose paid window (`planValidUntil`) has lapsed.
//
// Admins always pass the gate. They aren't customers; an admin browsing
// premium-only support endpoints must not be locked out by their own
// `plan='free'` row.
//
// Lifetime entitlement is represented by `plan='premium'` with
// `planValidUntil=null`; treat null as "no expiry" rather than "expired".
const requirePlan = (auth, plan) => {
  if (!auth) throw ApiError.unauthorized();
  if (auth.role === 'admin') return auth;

  const userPlan = auth.doc?.plan || 'free';
  if (userPlan !== plan) {
    throw new ApiError(403, `${plan} plan required`, { code: 'PLAN_REQUIRED' });
  }

  const validUntil = auth.doc?.planValidUntil;
  if (validUntil && validUntil.getTime() < Date.now()) {
    throw new ApiError(403, `${plan} entitlement expired`, { code: 'PLAN_EXPIRED' });
  }

  return auth;
};

module.exports = { requireAuth, requireRole, requirePlan };
