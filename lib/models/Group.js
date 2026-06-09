const mongoose = require('mongoose');
const { CURRENCIES } = require('../config/constants');

// Split-expenses group (Splitwise-style). The owner creates it; other
// users join as members via GroupMember. Balances are DERIVED from
// SplitExpense + Settlement rows — never stored on the group — so an
// edit/delete stays correct with nothing to patch.
const groupSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 300, default: '' },
    currency: { type: String, enum: CURRENCIES, default: 'INR' },
    // When true, the balances view returns the greedy "simplified"
    // payment set (fewest paybacks) instead of raw per-pair debts.
    simplifyDebts: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

groupSchema.query.notDeleted = function notDeleted() {
  return this.where({ deletedAt: null });
};

module.exports = mongoose.models.Group || mongoose.model('Group', groupSchema);
