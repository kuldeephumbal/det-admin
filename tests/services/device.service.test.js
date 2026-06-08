const deviceService = require('../../lib/services/device.service');
const Device = require('../../lib/models/Device');
const RefreshToken = require('../../lib/models/RefreshToken');
const Notification = require('../../lib/models/Notification');
const { ensureDb, makeUser } = require('../helpers');

beforeAll(ensureDb);

// Notification.dispatch is fire-and-forget; let it flush before asserting.
const flush = () => new Promise((r) => setImmediate(r));

describe('device.service.register', () => {
  it('creates a Device row on first call', async () => {
    const user = await makeUser({ email: 'd1@example.com' });
    const d = await deviceService.register(String(user._id), {
      fcmToken: 'token-' + 'a'.repeat(40),
      platform: 'android',
      model: 'Pixel 7',
      appVersion: '0.1.0',
    });

    expect(d.id).toEqual(expect.any(String));
    expect(d.platform).toBe('android');
    expect(d.isActive).toBe(true);

    const stored = await Device.findById(d.id).lean();
    expect(stored.user.toString()).toBe(String(user._id));
    expect(stored.fcmToken).toMatch(/^token-/);
    expect(stored.lastSeenAt).toBeInstanceOf(Date);
  });

  it('upserts the same (user, token) instead of creating a duplicate', async () => {
    const user = await makeUser({ email: 'd2@example.com' });
    const token = 'tok-' + 'b'.repeat(40);

    const first = await deviceService.register(String(user._id), {
      fcmToken: token, platform: 'ios', model: 'iPhone 13',
    });
    const earlierSeen = (await Device.findById(first.id).lean()).lastSeenAt;

    // Small wait so lastSeenAt visibly advances.
    await new Promise((r) => setTimeout(r, 5));

    const second = await deviceService.register(String(user._id), {
      fcmToken: token, platform: 'ios', model: 'iPhone 13 Pro',
    });

    expect(second.id).toBe(first.id);
    const count = await Device.countDocuments({ user: user._id });
    expect(count).toBe(1);

    const reloaded = await Device.findById(second.id).lean();
    expect(reloaded.model).toBe('iPhone 13 Pro');
    expect(reloaded.lastSeenAt.getTime()).toBeGreaterThan(earlierSeen.getTime());
  });

  it('steals a token away from another user (sign-out then sign-in on same device)', async () => {
    const alice = await makeUser({ email: 'alice-d@example.com' });
    const bob = await makeUser({ email: 'bob-d@example.com' });
    const token = 'tok-shared-' + 'c'.repeat(30);

    await deviceService.register(String(alice._id), {
      fcmToken: token, platform: 'android',
    });
    await deviceService.register(String(bob._id), {
      fcmToken: token, platform: 'android',
    });

    const aliceDevice = await Device.findOne({ user: alice._id }).lean();
    const bobDevice = await Device.findOne({ user: bob._id }).lean();

    expect(aliceDevice.isActive).toBe(false);
    expect(aliceDevice.fcmToken).toBeUndefined();
    expect(bobDevice.isActive).toBe(true);
    expect(bobDevice.fcmToken).toBe(token);
  });

  it('LRU-deactivates older devices beyond the cap', async () => {
    // Cap defaults to 10 (env.FCM_MAX_DEVICES_PER_USER). Register 12.
    const user = await makeUser({ email: 'lru@example.com' });
    for (let i = 0; i < 12; i++) {
      await deviceService.register(String(user._id), {
        fcmToken: `lru-tok-${i.toString().padStart(2, '0')}-` + 'x'.repeat(30),
        platform: 'android',
      });
      // Force strictly-increasing lastSeenAt timestamps.
      await new Promise((r) => setTimeout(r, 2));
    }

    const active = await Device.countDocuments({ user: user._id, isActive: true });
    const inactive = await Device.countDocuments({ user: user._id, isActive: false });
    expect(active).toBe(10);
    expect(inactive).toBe(2);
  });

  it('writes a "new device" notification on first registration only', async () => {
    const user = await makeUser({ email: 'newdev@example.com' });
    const tok = 'newdev-' + 'a'.repeat(40);

    await deviceService.register(String(user._id), {
      fcmToken: tok, platform: 'android', model: 'Pixel 7',
    });
    await flush();

    const first = await Notification.find({ user: user._id }).lean();
    expect(first).toHaveLength(1);
    expect(first[0].title).toMatch(/New sign-in/i);
    expect(first[0].deepLink).toBe('/settings/devices');

    // Re-register same (user, token) — should NOT spawn another notification.
    await deviceService.register(String(user._id), {
      fcmToken: tok, platform: 'android', model: 'Pixel 7',
    });
    await flush();

    const after = await Notification.countDocuments({ user: user._id });
    expect(after).toBe(1);
  });

  it('links the most-recent live refresh token to the new device', async () => {
    const user = await makeUser({ email: 'rtlink@example.com' });
    // Two refresh rows; the most recent should be the one linked.
    await RefreshToken.create({
      user: user._id,
      jti: 'jti-old',
      tokenHash: 'hash-old',
      expiresAt: new Date(Date.now() + 86400_000),
      createdAt: new Date(Date.now() - 5000),
    });
    const newer = await RefreshToken.create({
      user: user._id,
      jti: 'jti-new',
      tokenHash: 'hash-new',
      expiresAt: new Date(Date.now() + 86400_000),
    });

    const device = await deviceService.register(String(user._id), {
      fcmToken: 'rtlink-' + 'a'.repeat(40), platform: 'ios',
    });

    const updated = await RefreshToken.findById(newer._id).lean();
    expect(String(updated.deviceId)).toBe(device.id);
  });
});

describe('device.service.list', () => {
  it('returns active rows sorted by lastSeenAt desc and marks current', async () => {
    const user = await makeUser({ email: 'list@example.com' });
    const tokens = ['l-a', 'l-b', 'l-c'].map((t) => t + '-' + 'x'.repeat(40));
    const devices = [];
    for (const t of tokens) {
      devices.push(await deviceService.register(String(user._id), {
        fcmToken: t, platform: 'android',
      }));
      await new Promise((r) => setTimeout(r, 2));
    }

    const result = await deviceService.list(String(user._id), {
      currentDeviceId: devices[1].id,
    });

    expect(result.items).toHaveLength(3);
    // Most recently registered first.
    expect(result.items[0].id).toBe(devices[2].id);
    expect(result.items[2].id).toBe(devices[0].id);
    expect(result.items.find((d) => d.isCurrent).id).toBe(devices[1].id);
    expect(result.currentDeviceId).toBe(devices[1].id);
  });

  it('excludes inactive (revoked) devices', async () => {
    const user = await makeUser({ email: 'list-hidden@example.com' });
    const kept = await deviceService.register(String(user._id), {
      fcmToken: 'lh-keep-' + 'a'.repeat(40), platform: 'android',
    });
    const gone = await deviceService.register(String(user._id), {
      fcmToken: 'lh-gone-' + 'a'.repeat(40), platform: 'android',
    });
    await deviceService.revoke(String(user._id), gone.id);

    const result = await deviceService.list(String(user._id));
    expect(result.items.map((d) => d.id)).toEqual([kept.id]);
  });
});

describe('device.service.revoke', () => {
  it('deactivates the device, clears its fcmToken, and revokes linked refresh tokens', async () => {
    const user = await makeUser({ email: 'rev@example.com' });

    // Plant an active refresh that mimics the post-login state.
    const rt = await RefreshToken.create({
      user: user._id,
      jti: 'rev-jti',
      tokenHash: 'rev-hash',
      expiresAt: new Date(Date.now() + 86400_000),
    });

    const device = await deviceService.register(String(user._id), {
      fcmToken: 'rev-tok-' + 'a'.repeat(40), platform: 'android',
    });
    // Sanity: register linked the refresh row.
    const linked = await RefreshToken.findById(rt._id).lean();
    expect(String(linked.deviceId)).toBe(device.id);

    const revoked = await deviceService.revoke(String(user._id), device.id);
    expect(revoked.isActive).toBe(false);

    const stored = await Device.findById(device.id).lean();
    expect(stored.fcmToken).toBeUndefined();
    expect(stored.isActive).toBe(false);

    const reloaded = await RefreshToken.findById(rt._id).lean();
    expect(reloaded.revokedAt).toBeInstanceOf(Date);
  });

  it('rejects revoke of a device owned by another user with 404', async () => {
    const alice = await makeUser({ email: 'rev-a@example.com' });
    const bob = await makeUser({ email: 'rev-b@example.com' });
    const dev = await deviceService.register(String(alice._id), {
      fcmToken: 'crossuser-' + 'a'.repeat(40), platform: 'android',
    });

    await expect(deviceService.revoke(String(bob._id), dev.id)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('is idempotent — revoking twice keeps the same end-state', async () => {
    const user = await makeUser({ email: 'rev-idem@example.com' });
    const dev = await deviceService.register(String(user._id), {
      fcmToken: 'idem-' + 'a'.repeat(40), platform: 'android',
    });
    await deviceService.revoke(String(user._id), dev.id);

    // Second call should fail with 404 because the device was deactivated
    // AND the revoke query filters on `isActive: true`? Actually no — the
    // revoke query keys on _id+user only. So second call succeeds.
    const r2 = await deviceService.revoke(String(user._id), dev.id);
    expect(r2.isActive).toBe(false);
  });
});
