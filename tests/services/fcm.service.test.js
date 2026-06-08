// Tests for fcm.service.js. firebase-admin is an optionalDependency
// and may not be installed on the host — these tests therefore exercise
// the no-op path (SDK absent) explicitly, and stub require() when we
// want to assert against a real fan-out flow.

const path = require('path');
const Module = require('module');

const fcm = require('../../lib/services/fcm.service');
const Device = require('../../lib/models/Device');
const { ensureDb, makeUser } = require('../helpers');

beforeAll(ensureDb);

describe('fcm.service (no SDK / no creds)', () => {
  beforeEach(() => {
    delete process.env.FCM_CREDENTIALS_JSON;
    fcm.__resetForTests();
  });

  it('isConfigured() returns false without creds', () => {
    expect(fcm.isConfigured()).toBe(false);
  });

  it('sendToTokens returns the not_configured marker', async () => {
    const r = await fcm.sendToTokens(['tok-a', 'tok-b'], { title: 'hi', body: 'x' });
    expect(r).toMatchObject({
      successCount: 0,
      failureCount: 0,
      skipped: 'not_configured',
    });
  });

  it('sendToTokens with no tokens short-circuits', async () => {
    const r = await fcm.sendToTokens([], { title: 'x' });
    expect(r.skipped).toBe('no_tokens');
  });

  it('pruneInvalidTokens flips matching devices to inactive', async () => {
    const user = await makeUser({ email: 'prune@example.com' });
    await Device.create({
      user: user._id,
      fcmToken: 'dead-tok-' + 'a'.repeat(30),
      platform: 'android',
    });
    const removed = await fcm.pruneInvalidTokens(user._id, ['dead-tok-' + 'a'.repeat(30)]);
    expect(removed).toBe(1);
    const reloaded = await Device.findOne({ user: user._id }).lean();
    expect(reloaded.isActive).toBe(false);
    expect(reloaded.fcmToken).toBeUndefined();
  });
});

describe('fcm.service (mocked SDK)', () => {
  let originalResolve;
  let fakeAdmin;
  let multicastCalls;

  beforeEach(() => {
    multicastCalls = [];

    fakeAdmin = {
      apps: [],
      credential: {
        cert: jest.fn(() => 'fake-cert-handle'),
      },
      initializeApp: jest.fn(function init(opts) {
        this.apps.push({ opts });
        return this.apps[0];
      }),
      messaging: () => ({
        sendEachForMulticast: async ({ tokens }) => {
          multicastCalls.push(tokens);
          // Simulate one dead token at index 1 if present.
          return {
            successCount: Math.max(tokens.length - 1, 0),
            failureCount: tokens.length > 1 ? 1 : 0,
            responses: tokens.map((_, i) => ({
              success: i !== 1,
              error: i === 1 ? { code: 'messaging/registration-token-not-registered' } : undefined,
            })),
          };
        },
      }),
    };

    // Intercept require('firebase-admin').
    originalResolve = Module._resolveFilename;
    Module._resolveFilename = function patched(request, parent, ...rest) {
      if (request === 'firebase-admin') return path.resolve('__fake_firebase_admin__');
      return originalResolve.call(this, request, parent, ...rest);
    };
    require.cache[path.resolve('__fake_firebase_admin__')] = {
      id: path.resolve('__fake_firebase_admin__'),
      filename: path.resolve('__fake_firebase_admin__'),
      loaded: true,
      exports: fakeAdmin,
    };

    // Minimal valid base64 service account.
    process.env.FCM_CREDENTIALS_JSON = Buffer.from(
      JSON.stringify({ project_id: 'det-test', private_key: 'x', client_email: 'x@x' })
    ).toString('base64');
    process.env.FCM_PROJECT_ID = 'det-test';
    fcm.__resetForTests();
  });

  afterEach(() => {
    Module._resolveFilename = originalResolve;
    delete require.cache[path.resolve('__fake_firebase_admin__')];
    delete process.env.FCM_CREDENTIALS_JSON;
    delete process.env.FCM_PROJECT_ID;
    fcm.__resetForTests();
  });

  it('initializes the SDK once and sends a multicast', async () => {
    const tokens = ['good-tok', 'bad-tok'];
    const r = await fcm.sendToTokens(tokens, {
      title: 'Hello',
      body: 'world',
      data: { x: 1 },
      deepLink: '/budgets/123',
    });

    expect(fakeAdmin.initializeApp).toHaveBeenCalledTimes(1);
    expect(multicastCalls).toHaveLength(1);
    expect(multicastCalls[0]).toEqual(tokens);

    expect(r.successCount).toBe(1);
    expect(r.failureCount).toBe(1);
    expect(r.invalidTokens).toEqual(['bad-tok']);
  });

  it('chunks > 500 tokens into multiple multicast calls', async () => {
    const tokens = Array.from({ length: 503 }, (_, i) => `t-${i}`);
    await fcm.sendToTokens(tokens, { title: 't', body: 'b' });
    expect(multicastCalls).toHaveLength(2);
    expect(multicastCalls[0]).toHaveLength(500);
    expect(multicastCalls[1]).toHaveLength(3);
  });
});
