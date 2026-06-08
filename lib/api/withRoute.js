// withRoute(handler, options) — wraps a Next.js App Router Route Handler with:
//   * DB connection (ensures Mongoose is ready)
//   * CORS headers
//   * Rate limiting (per IP + bucket)
//   * JSON body parsing + Joi validation (body / query / params)
//   * Auth (Bearer JWT) + role check
//   * Centralized error → JSON envelope translation
//
// Usage in app/api/.../route.js:
//
//   const { withRoute } = require('@/lib/api/withRoute');
//   const v = require('@/lib/validators/auth.validator');
//
//   exports.POST = withRoute(
//     async ({ body, req }) => { ... return ApiResponse.created(...) },
//     { schema: v.register, rateLimit: { bucket: 'auth' } }
//   );

const mongoose = require('mongoose');
const { NextResponse } = require('next/server');

const connectDB = require('../db');
const env = require('../config/env');
const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');
const { validate } = require('./validate');
const { requireAuth, requireRole, requirePlan } = require('./auth');
const { checkRateLimit } = require('./rateLimit');
const { buildCorsHeaders } = require('./cors');

const readJson = async (req) => {
  const contentType = req.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return {};
  try {
    const text = await req.text();
    if (!text) return {};
    return JSON.parse(text);
  } catch (_) {
    throw ApiError.badRequest('Malformed JSON body');
  }
};

// Recursive guard against MongoDB operator injection in user-supplied JSON.
const sanitizeJson = (val) => {
  if (val === null || typeof val !== 'object') return val;
  if (Array.isArray(val)) return val.map(sanitizeJson);
  const out = {};
  for (const [k, v] of Object.entries(val)) {
    if (k.startsWith('$') || k.includes('.')) continue;
    out[k] = sanitizeJson(v);
  }
  return out;
};

const ipFrom = (req) =>
  req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
  req.headers.get('x-real-ip') ||
  '';

const toErrorResponse = (err, req) => {
  let e = err;

  if (!(e instanceof ApiError)) {
    if (e instanceof mongoose.Error.ValidationError) {
      const details = Object.values(e.errors).map((x) => ({
        field: x.path,
        message: x.message,
      }));
      e = ApiError.validation('Validation failed', details);
    } else if (e instanceof mongoose.Error.CastError) {
      e = ApiError.badRequest(`Invalid ${e.path}: ${e.value}`);
    } else if (e?.code === 11000) {
      const field = Object.keys(e.keyValue || {})[0] || 'field';
      e = ApiError.conflict(`Duplicate value for ${field}`, {
        field,
        value: e.keyValue?.[field],
      });
    } else if (e?.name === 'JsonWebTokenError') {
      e = ApiError.unauthorized('Invalid token');
    } else if (e?.name === 'TokenExpiredError') {
      e = ApiError.unauthorized('Token expired');
    } else {
      const statusCode = e?.statusCode || 500;
      e = new ApiError(statusCode, e?.message || 'Internal server error', {
        isOperational: false,
      });
    }
  }

  const lvl = e.statusCode >= 500 ? 'error' : 'warn';
  logger.log(lvl, e.message, {
    statusCode: e.statusCode,
    path: req?.nextUrl?.pathname || req?.url,
    method: req?.method,
    ...(env.NODE_ENV !== 'production' && e.stack && { stack: e.stack }),
  });

  const body = {
    success: false,
    error: {
      code: e.code,
      message: e.message,
      ...(e.details && { details: e.details }),
      ...(env.NODE_ENV !== 'production' && !e.isOperational && { stack: e.stack }),
    },
  };

  return { status: e.statusCode, body };
};

function withRoute(handler, options = {}) {
  const {
    auth = false,        // true | 'admin' | false
    schema = null,       // { body?, query?, params? }
    rateLimit = null,    // { bucket?, windowMs?, max? } | false
    skipDb = false,
    requireVerified = false, // gates write paths until the user's email is verified
    plan = null,             // gates premium-only routes (e.g. 'premium')
  } = options;

  return async function wrappedRouteHandler(req, ctx = {}) {
    const origin = req.headers.get('origin') || '';
    const corsHeaders = buildCorsHeaders(origin);

    if (req.method === 'OPTIONS') {
      return new NextResponse(null, { status: 204, headers: corsHeaders });
    }

    try {
      if (rateLimit !== false) checkRateLimit(req, rateLimit || {});

      if (!skipDb) await connectDB();

      let body;
      if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
        body = sanitizeJson(await readJson(req));
        if (schema?.body) body = validate(schema.body, body, 'body');
      } else if (schema?.body) {
        body = validate(schema.body, {}, 'body');
      }

      const url = new URL(req.url);
      const queryObj = Object.fromEntries(url.searchParams.entries());
      const query = schema?.query ? validate(schema.query, queryObj, 'query') : queryObj;

      const rawParams = ctx.params ? await ctx.params : {};
      const params = schema?.params ? validate(schema.params, rawParams, 'params') : rawParams;

      let user = null;
      if (auth) {
        user = await requireAuth(req);
        if (auth === 'admin') requireRole(user, 'admin');
        else if (Array.isArray(auth)) requireRole(user, ...auth);

        // Admin sessions bypass the verification gate — admins are
        // provisioned out of band and aren't part of the consumer flow.
        if (requireVerified && user.role !== 'admin' && !user.doc?.emailVerifiedAt) {
          throw new ApiError(403, 'Email not verified', { code: 'EMAIL_NOT_VERIFIED' });
        }

        if (plan) requirePlan(user, plan);
      }

      const context = {
        req,
        body,
        query,
        params,
        user,
        ip: ipFrom(req),
        userAgent: req.headers.get('user-agent') || '',
        origin,
      };

      const response = await handler(context);
      // Stamp CORS headers on the outgoing response.
      if (response instanceof Response) {
        for (const [k, v] of Object.entries(corsHeaders)) response.headers.set(k, v);
        return response;
      }
      return NextResponse.json(response, { status: 200, headers: corsHeaders });
    } catch (err) {
      const { status, body } = toErrorResponse(err, req);
      return NextResponse.json(body, { status, headers: corsHeaders });
    }
  };
}

module.exports = { withRoute };
