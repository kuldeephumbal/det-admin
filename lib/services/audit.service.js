const AuditLog = require('../models/AuditLog');
const { parsePagination } = require('../utils/pagination');
const logger = require('../utils/logger');

// Write a single audit log entry. Failures are logged but never thrown —
// the caller is wrapping a successful admin mutation, and we don't want a
// flaky log write to mask the user-visible success.
const record = async ({
  actor,           // User document or { _id, email, name }
  action,
  target = null,   // { type, id } or null
  before = null,
  after = null,
  meta = null,
  statusCode = 200,
  ip = '',
  userAgent = '',
}) => {
  if (!actor || !action) {
    logger.warn('audit.record skipped — missing actor or action', { action });
    return null;
  }

  try {
    return await AuditLog.create({
      actor: actor._id || actor.id,
      actorEmail: actor.email || '',
      actorName: actor.name || '',
      action,
      targetType: target?.type || null,
      targetId: target?.id ? String(target.id) : null,
      before,
      after,
      meta,
      statusCode,
      ip,
      userAgent,
    });
  } catch (err) {
    logger.error('audit.record failed', {
      action,
      target,
      message: err.message,
    });
    return null;
  }
};

// Paginated listing with optional filters. Used by GET /api/v1/admin/audit-log.
const list = async (query = {}) => {
  const { page, limit, skip } = parsePagination(query);
  const filter = {};
  if (query.action) filter.action = query.action;
  if (query.targetType) filter.targetType = query.targetType;
  if (query.targetId) filter.targetId = String(query.targetId);
  if (query.actor) filter.actor = query.actor;

  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  return {
    items: items.map(_toJson),
    page,
    limit,
    total,
  };
};

const _toJson = (doc) => ({
  id: String(doc._id),
  actor: String(doc.actor),
  actorEmail: doc.actorEmail,
  actorName: doc.actorName,
  action: doc.action,
  targetType: doc.targetType,
  targetId: doc.targetId,
  before: doc.before,
  after: doc.after,
  meta: doc.meta,
  statusCode: doc.statusCode,
  ip: doc.ip,
  userAgent: doc.userAgent,
  createdAt: doc.createdAt,
});

module.exports = { record, list };
