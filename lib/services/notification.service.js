const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const Device = require('../models/Device');
const ApiError = require('../utils/ApiError');
const { parsePagination } = require('../utils/pagination');
const fcm = require('./fcm.service');
const logger = require('../utils/logger');

const oid = (id) => new mongoose.Types.ObjectId(String(id));

const toPublic = (doc) => ({
  id: String(doc._id),
  type: doc.type,
  title: doc.title,
  body: doc.body || '',
  data: doc.data || {},
  isRead: !!doc.isRead,
  readAt: doc.readAt || null,
  createdAt: doc.createdAt,
});

// Personal inbox (user-scoped) plus any system-wide broadcasts (user: null).
const buildFilter = (userId, q) => {
  const filter = {
    $or: [{ user: oid(userId) }, { user: null }],
  };
  if (q.unreadOnly) filter.isRead = false;
  if (q.type) filter.type = q.type;
  return filter;
};

const list = async (userId, q = {}) => {
  const { page, limit, skip } = parsePagination(q);
  const filter = buildFilter(userId, q);

  const [items, total] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
  ]);

  return { items: items.map(toPublic), page, limit, total };
};

const unreadCount = async (userId) => {
  const count = await Notification.countDocuments({
    $or: [{ user: oid(userId) }, { user: null }],
    isRead: false,
  });
  return { count };
};

const markRead = async (userId, id) => {
  const doc = await Notification.findOneAndUpdate(
    {
      _id: id,
      $or: [{ user: oid(userId) }, { user: null }],
      isRead: false,
    },
    { $set: { isRead: true, readAt: new Date() } },
    { new: true }
  );
  if (!doc) {
    // Either already-read or not found. Both are non-errors for an idempotent
    // mark-read; let the controller decide whether to surface 404.
    const exists = await Notification.exists({
      _id: id,
      $or: [{ user: oid(userId) }, { user: null }],
    });
    if (!exists) throw ApiError.notFound('Notification not found');
  }
  return doc ? toPublic(doc) : null;
};

const markAllRead = async (userId) => {
  const r = await Notification.updateMany(
    {
      $or: [{ user: oid(userId) }, { user: null }],
      isRead: false,
    },
    { $set: { isRead: true, readAt: new Date() } }
  );
  return { modified: r.modifiedCount || 0 };
};

// Single entry-point for ALL notification creation. Callers (budget
// alerts, recurring reminders, admin broadcasts, etc.) MUST go through
// this rather than calling Notification.create directly, so push fan-out
// stays in lockstep with the in-app row.
//
// Returns the persisted notification doc (toPublic shape). FCM fan-out
// is fire-and-forget — a flaky push provider never blocks the in-app
// inbox row from being created.
//
// args:
//   user       ObjectId | string | null    null = broadcast (all users)
//   type       NOTIFICATION_TYPES.*
//   title      string
//   body       string?
//   data       object?
//   deepLink   string?
//   pushOnly   boolean?   skip the in-app row, FCM only (rare)
//   skipPush   boolean?   write inbox row but don't dispatch push
const dispatch = async (args) => {
  const {
    user = null,
    type,
    title,
    body = '',
    data = {},
    deepLink = '',
    pushOnly = false,
    skipPush = false,
    scheduledFor = null,
    expiresAt = null,
  } = args;

  if (!type || !title) {
    throw new Error('notification.dispatch requires { type, title }');
  }

  let doc = null;
  if (!pushOnly) {
    doc = await Notification.create({
      user: user ? oid(user) : null,
      type,
      title,
      body,
      data,
      deepLink,
      scheduledFor,
      expiresAt,
    });
  }

  if (skipPush || scheduledFor) {
    return doc ? toPublic(doc) : null;
  }

  // Fan-out happens asynchronously so the caller isn't blocked on FCM
  // latency. Errors are swallowed after logging — the in-app row is the
  // source of truth and is already persisted.
  Promise.resolve()
    .then(() => _fanOut({ user, doc, title, body, data, deepLink }))
    .catch((err) => logger.warn('notification.dispatch fan-out failed', { message: err.message }));

  return doc ? toPublic(doc) : null;
};

const _fanOut = async ({ user, doc, title, body, data, deepLink }) => {
  // Pull the set of active devices that should receive this push. For
  // a per-user notification it's that user's devices; for a broadcast
  // (user=null) it's every active device in the system.
  const deviceFilter = user
    ? { user: oid(user), isActive: true, fcmToken: { $exists: true, $ne: '' } }
    : { isActive: true, fcmToken: { $exists: true, $ne: '' } };

  // For broadcasts we project `user` too so we can prune invalid tokens
  // back to the owning Device row without an extra round-trip.
  const projection = user ? 'fcmToken' : 'fcmToken user';

  const devices = await Device.find(deviceFilter).select(projection).lean();
  const tokens = devices.map((d) => d.fcmToken).filter(Boolean);
  if (tokens.length === 0) return;

  // fcm.sendToTokens already batches at 500 internally. A flat call is
  // fine up to ~50k tokens; at that scale switch to a queued worker
  // (RECOMMEND: separate cron route that pages devices and dispatches
  // batches with exponential backoff between failures).
  const result = await fcm.sendToTokens(tokens, { title, body, data, deepLink });

  if (doc) {
    await Notification.updateOne(
      { _id: doc._id },
      {
        $set: {
          'pushDelivery.attemptedAt': new Date(),
          'pushDelivery.succeededCount': result.successCount,
          'pushDelivery.failedCount': result.failureCount,
          'pushDelivery.lastError': result.lastError || '',
          sentAt: new Date(),
        },
      }
    ).catch((err) => logger.warn('failed to stamp pushDelivery on notification', { message: err.message }));
  }

  if (result.invalidTokens && result.invalidTokens.length > 0) {
    if (user) {
      // Single-user path: every dead token belongs to this user.
      await fcm.pruneInvalidTokens(oid(user), result.invalidTokens).catch(() => {});
    } else {
      // Broadcast path: dead tokens span many users. Group them back to
      // the right user via the projection we kept above so the prune
      // query stays scoped per user (matches the index on Device.user).
      const tokenToUser = new Map();
      for (const d of devices) {
        if (d.fcmToken) tokenToUser.set(d.fcmToken, String(d.user));
      }
      const byUser = new Map();
      for (const tok of result.invalidTokens) {
        const u = tokenToUser.get(tok);
        if (!u) continue;
        if (!byUser.has(u)) byUser.set(u, []);
        byUser.get(u).push(tok);
      }
      for (const [u, toks] of byUser) {
        await fcm.pruneInvalidTokens(oid(u), toks).catch(() => {});
      }
    }
  }
};

module.exports = { list, unreadCount, markRead, markAllRead, dispatch };
