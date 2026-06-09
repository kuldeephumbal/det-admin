const mongoose = require('mongoose');
const { GROUP_ROLES, GROUP_MEMBER_STATUSES } = require('../config/constants');

// GroupMember — links a user (or a not-yet-registered phone contact) to
// a split-expenses Group. Mirrors AccountMembership's invite lifecycle:
//
//   pending  → invited; hasn't accepted (user) / signed up (phone)
//   active   → participating
//   declined → said no (terminal)
//   revoked  → was active, removed (owner kick OR self-leave)
//
// `user` is null for phone-only pending invites (the contact isn't a DET
// user yet). It's filled in when they sign up and redeem the invite
// token, or when matched by normalized phone.
const groupMemberSchema = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    // E.164-normalized phone for matching/inviting a contact who may not
    // be a DET user yet.
    phone: { type: String, default: null },
    // Display name carried from the inviter's contact list — shown for
    // pending phone-only members before they register.
    displayName: { type: String, trim: true, maxlength: 80, default: '' },
    role: { type: String, enum: GROUP_ROLES, default: 'member' },
    status: { type: String, enum: GROUP_MEMBER_STATUSES, default: 'pending', index: true },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // sha256 of the raw invite token sent via SMS; consumed on redeem.
    inviteTokenHash: { type: String, default: null, index: true },
    inviteTokenExpires: { type: Date, default: null },
    invitedAt: { type: Date, default: Date.now },
    acceptedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// One membership per (group, user) — partial so multiple phone-only
// rows (user:null) don't collide on null (same lesson as the googleSub
// sparse→partial fix).
groupMemberSchema.index(
  { group: 1, user: 1 },
  { unique: true, partialFilterExpression: { user: { $type: 'objectId' } } }
);
// One pending invite per (group, phone) for phone-only rows.
groupMemberSchema.index(
  { group: 1, phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $type: 'string' } } }
);
groupMemberSchema.index({ user: 1, status: 1 });

module.exports =
  mongoose.models.GroupMember || mongoose.model('GroupMember', groupMemberSchema);
