const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    jti: { type: String, required: true, unique: true, index: true },
    tokenHash: { type: String, required: true },
    userAgent: { type: String, default: '' },
    ip: { type: String, default: '' },
    // Optional link to the Device that issued this refresh token. Older
    // tokens predate the Device collection and stay null — that's fine:
    // `revoke` keys on `(user, deviceId)` and a null-deviceId revoke just
    // skips them, which is the desired backward-compatible behavior.
    deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', default: null, index: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    revokedAt: { type: Date, default: null },
    replacedByJti: { type: String, default: null },
  },
  { timestamps: true }
);

refreshTokenSchema.index({ user: 1, revokedAt: 1 });
// Hot path for device revoke: find all live tokens for a given device.
refreshTokenSchema.index({ deviceId: 1, revokedAt: 1 });

refreshTokenSchema.methods.isActive = function isActive() {
  return !this.revokedAt && this.expiresAt > new Date();
};

module.exports = mongoose.models.RefreshToken || mongoose.model('RefreshToken', refreshTokenSchema);
