const Joi = require('joi');
const { withRoute } = require('../../lib/api/withRoute');
const ApiResponse = require('../../lib/utils/ApiResponse');
const ApiError = require('../../lib/utils/ApiError');
const { signAccessToken } = require('../../lib/utils/jwt');
const { ensureDb, makeUser } = require('../helpers');

beforeAll(ensureDb);

// Tiny request factory — Next.js Route Handlers receive a standard Request.
const makeReq = ({ method = 'GET', url = 'http://localhost/api/v1/x', body, headers = {} } = {}) =>
  new Request(url, {
    method,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

const parse = async (res) => ({ status: res.status, body: await res.json() });

describe('withRoute', () => {
  it('runs the handler and wraps the response', async () => {
    const handler = withRoute(async () => ApiResponse.ok({ hello: 'world' }), {
      skipDb: true,
      rateLimit: false,
    });
    const { status, body } = await parse(await handler(makeReq()));
    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true, data: { hello: 'world' } });
  });

  it('returns 422 with details on Joi validation failure', async () => {
    const handler = withRoute(async () => ApiResponse.ok({}), {
      skipDb: true,
      rateLimit: false,
      schema: { body: Joi.object({ amount: Joi.number().positive().required() }) },
    });
    const { status, body } = await parse(
      await handler(makeReq({ method: 'POST', body: { amount: -1 } }))
    );
    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details[0]).toMatchObject({ field: 'amount', location: 'body' });
  });

  it('strips $-prefixed keys from JSON bodies (Mongo operator injection guard)', async () => {
    let received;
    const handler = withRoute(
      async ({ body }) => {
        received = body;
        return ApiResponse.ok({});
      },
      { skipDb: true, rateLimit: false }
    );
    await handler(makeReq({
      method: 'POST',
      body: { email: 'x@example.com', $ne: 'oops', nested: { $gt: 1, ok: 2 } },
    }));
    expect(received).toEqual({ email: 'x@example.com', nested: { ok: 2 } });
  });

  it('rejects missing access token with 401 when auth: true', async () => {
    const handler = withRoute(async () => ApiResponse.ok({}), { auth: true, rateLimit: false });
    const { status, body } = await parse(await handler(makeReq()));
    expect(status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('accepts a valid Bearer token and exposes ctx.user', async () => {
    const user = await makeUser({ email: 'bearer@example.com' });
    const token = signAccessToken({ sub: String(user._id), role: 'user' });

    let captured;
    const handler = withRoute(
      async ({ user: u }) => {
        captured = u;
        return ApiResponse.ok({});
      },
      { auth: true, rateLimit: false }
    );

    const { status } = await parse(await handler(makeReq({
      headers: { authorization: `Bearer ${token}` },
    })));
    expect(status).toBe(200);
    expect(captured).toMatchObject({ id: String(user._id), role: 'user' });
  });

  it('forbids non-admin Bearer when auth: "admin"', async () => {
    const user = await makeUser({ email: 'plebe@example.com' });
    const token = signAccessToken({ sub: String(user._id), role: 'user' });

    const handler = withRoute(async () => ApiResponse.ok({}), { auth: 'admin', rateLimit: false });
    const { status, body } = await parse(await handler(makeReq({
      headers: { authorization: `Bearer ${token}` },
    })));
    expect(status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('translates ApiError instances thrown by the handler', async () => {
    const handler = withRoute(
      async () => { throw ApiError.notFound('gone'); },
      { skipDb: true, rateLimit: false }
    );
    const { status, body } = await parse(await handler(makeReq()));
    expect(status).toBe(404);
    expect(body.error).toMatchObject({ code: 'NOT_FOUND', message: 'gone' });
  });

  it('handles malformed JSON bodies with 400', async () => {
    const handler = withRoute(async () => ApiResponse.ok({}), {
      skipDb: true,
      rateLimit: false,
      schema: { body: Joi.object({ a: Joi.number() }) },
    });
    const req = new Request('http://localhost/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    });
    const { status, body } = await parse(await handler(req));
    expect(status).toBe(400);
    expect(body.error.code).toBe('BAD_REQUEST');
  });

  it('adds CORS headers to the response', async () => {
    const handler = withRoute(async () => ApiResponse.ok({}), { skipDb: true, rateLimit: false });
    const res = await handler(makeReq({ headers: { origin: 'http://localhost:5173' } }));
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
  });

  it('responds to OPTIONS preflight with 204', async () => {
    const handler = withRoute(async () => ApiResponse.ok({}), { skipDb: true, rateLimit: false });
    const res = await handler(makeReq({ method: 'OPTIONS' }));
    expect(res.status).toBe(204);
  });
});
