const mongoose = require('mongoose');
const { ACCOUNT_ROLES, MEMBERSHIP_STATUSES } = require('../config/constants');

// AccountMembership — links a user to an account they don't own.
// The account's `user` field stays the owner reference; members live
// in this separate collection so a single Account.findOne() doesn't
// have to drag along the membership list.
//
// Lifecycle (`status` transitions):
//   pending  → owner invited; invitee hasn't acted yet
//   active   → invitee accepted; reads + writes allowed
//   declined → invitee said no (terminal; never re-used)
//   revoked  → was active, now removed (owner kick OR self-leave)
//
// Unique (account, user) guarantees we never have two rows for the
// same pair — a revoked-then-re-invited user just flips status back
// to `pending` on the existing row.

const accountMembershipSchema = new mongoose.Schema(
  {
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: ACCOUNT_ROLES, default: 'member' },
    status: {
      type: String,
      enum: MEMBERSHIP_STATUSES,
      default: 'pending',
      index: true,
    },

    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    invitedAt: { type: Date, default: Date.now },
    acceptedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    // Reason captured for the audit trail when an owner kicks a
    // member or a member self-leaves. Never shown to the other party.
    revokedReason: { type: String, default: '' },
  },
  { timestamps: true }
);

// One membership per (account, user). Allows a re-invite to flip the
// existing row's status back to 'pending' rather than mint a new row.
accountMembershipSchema.index({ account: 1, user: 1 }, { unique: true });
// Useful for "who can see this account?" queries.
accountMembershipSchema.index({ user: 1, status: 1 });
accountMembershipSchema.index({ account: 1, status: 1 });

module.exports =
  mongoose.models.AccountMembership
  || mongoose.model('AccountMembership', accountMembershipSchema);
