const mongoose = require('mongoose');

// Generic singleton-per-key store for runtime-editable settings. The
// admin Settings UI writes here, and downstream services (mailer, FCM,
// billing, ...) read from here with env vars as the fallback.
//
// Secrets (passwords, API keys) are stored encrypted inside `value`
// — see lib/services/settings.service.js for the encrypt/decrypt
// wrappers. Never log the `value` field directly.

const appSettingSchema = new mongoose.Schema(
  {
    // 'smtp' | 'fcm' | 'billing.stripe' | ...
    key: { type: String, required: true, unique: true, index: true },
    value: { type: mongoose.Schema.Types.Mixed, default: {} },
    updatedBy: {
      _id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      email: String,
      name: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.AppSetting || mongoose.model('AppSetting', appSettingSchema);
