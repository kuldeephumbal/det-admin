const mongoose = require('mongoose');
const { CURRENCIES } = require('../config/constants');

// System-owned, admin-managed parser rules for the Android SMS
// detector (Feature 11). Mobile clients fetch the active set on app
// start and run regex matches on-device — SMS bodies NEVER leave
// the device.
//
// Versioned so the mobile parser can skip rules it doesn't trust
// (e.g., rolled back via admin UI before the field hardens).

const smsParserRuleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    bankName: { type: String, trim: true, default: '' },
    // Regex caps are short to avoid ReDoS — see validator. Stored as
    // raw strings so the mobile parser can compile them in its own
    // language (Dart RegExp), not pre-compiled JS RegExps.
    senderPattern: { type: String, required: true, maxlength: 200 },
    amountRegex: { type: String, required: true, maxlength: 200 },
    merchantRegex: { type: String, default: '', maxlength: 200 },
    datePattern: { type: String, default: '', maxlength: 80 },
    currency: { type: String, enum: CURRENCIES, default: 'INR' },

    // Schema version of the rule shape. Bumped when fields are added,
    // so older mobile builds can ignore rules they can't fully use.
    version: { type: Number, default: 1, min: 1 },

    // Active rules are the only ones returned to mobile. Inactive
    // rules are kept for audit / rollback.
    isActive: { type: Boolean, default: true, index: true },
    notes: { type: String, default: '', maxlength: 500 },
  },
  { timestamps: true }
);

smsParserRuleSchema.index({ isActive: 1, updatedAt: -1 });
smsParserRuleSchema.index({ bankName: 1 });

module.exports =
  mongoose.models.SmsParserRule || mongoose.model('SmsParserRule', smsParserRuleSchema);
