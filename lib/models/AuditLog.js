const mongoose = require('mongoose');

// Append-only log of admin actions. Surfaced at /admin/audit-log and
// written by lib/api/auditLog.js#withAudit.
//
// Field choices:
//   - actor      — the admin who performed the action (ObjectId)
//   - actorEmail / actorName — denormalised so the log survives if the
//                  admin user is later deleted or renamed
//   - action     — string like "user.updateStatus", "category.delete"
//   - target     — { type, id } pointing at the affected entity
//   - before / after — optional document snapshots; for status changes
//                  these are commonly tiny ({ status: 'active' })
//   - meta       — anything else worth recording (request body, search
//                  filters, etc.) — schema-less Mixed
//   - statusCode — final HTTP status returned to the admin
//   - ip / userAgent — provenance, helps with abuse review
const auditLogSchema = new mongoose.Schema(
  {
    actor:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    actorEmail: { type: String, required: true, lowercase: true, trim: true },
    actorName:  { type: String, trim: true, default: '' },

    action:     { type: String, required: true, trim: true, index: true },

    targetType: { type: String, trim: true, default: null, index: true },
    targetId:   { type: String, trim: true, default: null },

    before:     { type: mongoose.Schema.Types.Mixed, default: null },
    after:      { type: mongoose.Schema.Types.Mixed, default: null },
    meta:       { type: mongoose.Schema.Types.Mixed, default: null },

    statusCode: { type: Number, default: 200 },
    ip:         { type: String, trim: true, default: '' },
    userAgent:  { type: String, trim: true, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Chronological listing — the dominant access pattern on /admin/audit-log.
auditLogSchema.index({ createdAt: -1 });
// Per-target history (e.g., "everything that's ever happened to user X").
auditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
// Per-actor history (e.g., "what has admin Y done lately").
auditLogSchema.index({ actor: 1, createdAt: -1 });

module.exports = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
