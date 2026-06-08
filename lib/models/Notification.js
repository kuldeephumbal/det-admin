const mongoose = require('mongoose');
const { NOTIFICATION_TYPES } = require('../config/constants');

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    type: { type: String, enum: Object.values(NOTIFICATION_TYPES), required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, trim: true, maxlength: 1000 },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
    scheduledFor: { type: Date, default: null, index: true },
    sentAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null, index: { expires: 0 } },
    deepLink: { type: String, trim: true, maxlength: 200, default: '' },
    pushDelivery: {
      attemptedAt: { type: Date, default: null },
      succeededCount: { type: Number, default: 0 },
      failedCount: { type: Number, default: 0 },
      lastError: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
