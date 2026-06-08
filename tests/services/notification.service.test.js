// Verifies dispatch() persists the in-app row in all cases and only
// engages the FCM fan-out path for user-targeted notifications. Push
// itself stays in the no-op path here (no FCM creds in test env) — the
// goal is to confirm the orchestration, not the FCM SDK.

const notifications = require('../../lib/services/notification.service');
const Notification = require('../../lib/models/Notification');
const Device = require('../../lib/models/Device');
const { ensureDb, makeUser } = require('../helpers');

beforeAll(ensureDb);

// Tiny helper to wait one event-loop tick so the fire-and-forget
// fan-out has a chance to stamp pushDelivery (still a no-op without
// creds, but the test asserts nothing crashes either way).
const flush = () => new Promise((r) => setImmediate(r));

describe('notification.service.dispatch', () => {
  it('writes an in-app row for a user-targeted notification', async () => {
    const user = await makeUser({ email: 'n1@example.com' });

    const result = await notifications.dispatch({
      user: String(user._id),
      type: 'budget_alert',
      title: 'Heads up',
      body: '70% of your Food budget',
      data: { pct: 70 },
      deepLink: '/budgets/abc',
    });

    expect(result.id).toEqual(expect.any(String));
    expect(result.type).toBe('budget_alert');
    expect(result.title).toBe('Heads up');

    const stored = await Notification.findById(result.id).lean();
    expect(stored.user.toString()).toBe(String(user._id));
    expect(stored.deepLink).toBe('/budgets/abc');
    expect(stored.body).toBe('70% of your Food budget');
    expect(stored.pushDelivery).toEqual(
      expect.objectContaining({ succeededCount: 0, failedCount: 0 })
    );
  });

  it('writes a broadcast row (user=null) and does NOT touch devices', async () => {
    const user = await makeUser({ email: 'n2@example.com' });
    await Device.create({
      user: user._id,
      fcmToken: 'broadcast-skip-' + 'a'.repeat(30),
      platform: 'android',
    });

    const r = await notifications.dispatch({
      user: null,
      type: 'announcement',
      title: 'Maintenance window',
      body: 'tomorrow 2-3am',
    });
    expect(r.id).toEqual(expect.any(String));

    const stored = await Notification.findById(r.id).lean();
    expect(stored.user).toBeNull();

    // Wait a tick — the no-fanout branch shouldn't touch the device row.
    await flush();
    const device = await Device.findOne({ user: user._id }).lean();
    expect(device.isActive).toBe(true);
  });

  it('rejects calls missing required fields', async () => {
    await expect(
      notifications.dispatch({ user: null, body: 'no type or title' })
    ).rejects.toThrow(/requires/);
  });

  it('skipPush still creates the in-app row', async () => {
    const user = await makeUser({ email: 'n3@example.com' });
    const r = await notifications.dispatch({
      user: String(user._id),
      type: 'system',
      title: 'Welcome',
      skipPush: true,
    });
    expect(r.id).toBeDefined();
    const stored = await Notification.findById(r.id).lean();
    expect(stored.title).toBe('Welcome');
  });
});
