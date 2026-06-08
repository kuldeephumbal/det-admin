const mongoose = require('mongoose');

// Minimal device registry used by FCM fan-out. The full Device Management
// feature (Phase 1, Feature 3) will extend this with revoke flow, "this
// device" markers, and links to RefreshToken families. For now we only
// need enough fields to push to a token.
//
// `fcmToken` is sparse-unique: the same physical device that re-installs
// the app gets a fresh token, and the old row's token is cleared (set to
// undefined) when the FCM SDK reports UNREGISTERED. Sparse means a row
// with no fcmToken (deactivated) doesn't collide with another inactive
// row.
const deviceSchema = new mongoose.Schema(
  {
    user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    fcmToken:    { type: String, trim: true },
    platform:    { type: String, enum: ['android', 'ios', 'web'], required: true },
    model:       { type: String, trim: true, maxlength: 80,  default: '' },
    osVersion:   { type: String, trim: true, maxlength: 40,  default: '' },
    appVersion:  { type: String, trim: true, maxlength: 20,  default: '' },
    locale:      { type: String, trim: true, maxlength: 20,  default: '' },
    ip:          { type: String, trim: true, default: '' },
    userAgent:   { type: String, trim: true, maxlength: 400, default: '' },
    firstSeenAt: { type: Date,   default: () => new Date() },
    lastSeenAt:  { type: Date,   default: () => new Date(), index: true },
    isActive:    { type: Boolean, default: true, index: true },
    revokedAt:   { type: Date,   default: null },
  },
  { timestamps: true }
);

// Sparse so deactivated rows (fcmToken cleared) don't fight for the
// unique slot.
deviceSchema.index({ fcmToken: 1 }, { unique: true, sparse: true });

// Hot read path: list a user's active devices in recency order.
deviceSchema.index({ user: 1, isActive: 1, lastSeenAt: -1 });

module.exports = mongoose.models.Device || mongoose.model('Device', deviceSchema);
