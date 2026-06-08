// Device registry service.
//
// Phase 1 Feature 1: token registration (used by FCM fan-out).
// Phase 1 Feature 3: list / revoke / "this device" markers, plus a
// suspicious-login notification on first-seen devices.

const mongoose = require('mongoose');
const Device = require('../models/Device');
const RefreshToken = require('../models/RefreshToken');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const { NOTIFICATION_TYPES } = require('../config/constants');
const notifications = require('./notification.service');
const logger = require('../utils/logger');

const oid = (id) => new mongoose.Types.ObjectId(String(id));

// Register or refresh the caller's device record. Idempotent on
// `(user, fcmToken)`: re-posting the same token from the same user just
// bumps lastSeenAt. When a different user posts a token previously seen
// elsewhere (rare — usually after sign-out/sign-in on the same physical
// device), the old row is deactivated to keep fcmToken sparse-unique.
//
// First-time registration for a user fires a "new device" notification
// to the user's *other* active devices (suspicious-login signal).
const register = async (userId, payload, ctx = {}) => {
  const userOid = oid(userId);

  // Detach this token from any other user it might be linked to. This
  // is the "sign-out forgot to call /devices/:id" recovery path.
  await Device.updateMany(
    { fcmToken: payload.fcmToken, user: { $ne: userOid } },
    { $set: { isActive: false, revokedAt: new Date() }, $unset: { fcmToken: '' } }
  );

  // Track whether we're creating the row vs touching an existing one,
  // so the "new device" alert only fires the first time.
  const existed = await Device.exists({ user: userOid, fcmToken: payload.fcmToken });

  const now = new Date();
  const doc = await Device.findOneAndUpdate(
    { user: userOid, fcmToken: payload.fcmToken },
    {
      $set: {
        platform: payload.platform,
        model: payload.model || '',
        osVersion: payload.osVersion || '',
        appVersion: payload.appVersion || '',
        locale: payload.locale || '',
        ip: ctx.ip || '',
        userAgent: ctx.userAgent || '',
        lastSeenAt: now,
        isActive: true,
        revokedAt: null,
      },
      $setOnInsert: { firstSeenAt: now },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await _enforceLruCap(userOid);

  // Best-effort link the user's most recent live refresh token (the one
  // created at login, just before /devices was called) to this device,
  // so a later revoke can cascade-cancel the session.
  //
  // Stale tokens (deviceId already set from a previous /devices call)
  // are left alone; this only fills in the null case.
  await RefreshToken.findOneAndUpdate(
    { user: userOid, revokedAt: null, deviceId: null, expiresAt: { $gt: new Date() } },
    { $set: { deviceId: doc._id } },
    { sort: { createdAt: -1 } }
  ).catch((err) => logger.warn('device.register refresh-link failed', { message: err.message }));

  if (!existed) {
    // Fire-and-forget — alerting must never fail the registration.
    _notifyNewDevice(userOid, doc).catch((err) =>
      logger.warn('device.register newDevice alert failed', { message: err.message })
    );
  }

  return _toPublic(doc);
};

// LRU eviction: keep at most FCM_MAX_DEVICES_PER_USER active rows per user.
// Deactivate the oldest beyond the cap so fan-out fan-out cost stays bounded.
const _enforceLruCap = async (userOid) => {
  const cap = env.FCM_MAX_DEVICES_PER_USER;
  if (!cap || cap < 1) return;

  const overflow = await Device.find({ user: userOid, isActive: true })
    .sort({ lastSeenAt: -1 })
    .skip(cap)
    .select('_id')
    .lean();

  if (overflow.length === 0) return;
  await Device.updateMany(
    { _id: { $in: overflow.map((d) => d._id) } },
    { $set: { isActive: false, revokedAt: new Date() }, $unset: { fcmToken: '' } }
  );
};

const _toPublic = (d) => ({
  id: String(d._id),
  platform: d.platform,
  model: d.model || '',
  osVersion: d.osVersion || '',
  appVersion: d.appVersion || '',
  locale: d.locale || '',
  lastSeenAt: d.lastSeenAt,
  firstSeenAt: d.firstSeenAt,
  isActive: !!d.isActive,
});

// List the caller's active devices, most recently seen first. Inactive
// rows are omitted — they're an internal detail of LRU eviction / dead
// tokens, not something users should see.
//
// `currentDeviceId` (if known) is echoed back so the UI can render a
// "this device" badge.
const list = async (userId, { currentDeviceId = null } = {}) => {
  const userOid = oid(userId);
  const rows = await Device.find({ user: userOid, isActive: true })
    .sort({ lastSeenAt: -1 })
    .lean();
  const items = rows.map((d) => ({
    ..._toPublic(d),
    isCurrent: currentDeviceId ? String(d._id) === String(currentDeviceId) : false,
  }));
  return { items, currentDeviceId: currentDeviceId ? String(currentDeviceId) : null };
};

// Revoke a single device. Cascades:
//   1. Flip the Device row to inactive + clear its fcmToken (so FCM
//      fan-out skips it).
//   2. Revoke every refresh token linked to that deviceId. Subsequent
//      access-token refresh requests for those jtis will get 401, which
//      the mobile interceptor translates into a force-logout.
// Idempotent: revoking an already-inactive device just no-ops.
const revoke = async (userId, deviceId) => {
  const userOid = oid(userId);
  const deviceOid = oid(deviceId);

  const doc = await Device.findOneAndUpdate(
    { _id: deviceOid, user: userOid },
    { $set: { isActive: false, revokedAt: new Date() }, $unset: { fcmToken: '' } },
    { new: true }
  );
  if (!doc) throw ApiError.notFound('Device not found');

  await RefreshToken.updateMany(
    { user: userOid, deviceId: deviceOid, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );

  return _toPublic(doc);
};

// Touch lastSeenAt on every successful refresh-token rotation. Cheap
// (single doc update) and gives Devices listing accurate recency data.
const touch = async (deviceId) => {
  if (!deviceId) return;
  await Device.updateOne({ _id: oid(deviceId) }, { $set: { lastSeenAt: new Date() } });
};

// Helper for auth.service.rotateRefreshToken: given the stored refresh
// row, return its associated deviceId (if any) so the new refresh row
// can be linked too. Always-safe to call.
const deviceIdForRefresh = (refreshDoc) => {
  return refreshDoc?.deviceId ? String(refreshDoc.deviceId) : null;
};

const _notifyNewDevice = async (userOid, deviceDoc) => {
  const where = [deviceDoc.model, deviceDoc.platform].filter(Boolean).join(' · ');
  await notifications.dispatch({
    user: userOid,
    type: NOTIFICATION_TYPES.SYSTEM,
    title: 'New sign-in detected',
    body: where
      ? `Signed in on ${where}. If this wasn't you, revoke it from Settings → Devices.`
      : "Signed in on a new device. If this wasn't you, revoke it from Settings → Devices.",
    data: { deviceId: String(deviceDoc._id) },
    deepLink: '/settings/devices',
  });
};

module.exports = { register, list, revoke, touch, deviceIdForRefresh };
