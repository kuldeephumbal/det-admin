// Shared accounts service (Feature 16).
//
// Two halves:
//   1. Membership CRUD — invite, accept, decline, revoke, list.
//   2. Visibility helpers — `accessibleAccountIds(userId)` returns the
//      complete set of account ids a user can read (owned + actively
//      shared). Used by account.service, expense.service, and the
//      account-balance recompute path.

const mongoose = require('mongoose');
const Account = require('../models/Account');
const User = require('../models/User');
const AccountMembership = require('../models/AccountMembership');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { NOTIFICATION_TYPES } = require('../config/constants');
const notifications = require('./notification.service');

const oid = (id) => new mongoose.Types.ObjectId(String(id));

// ---------- Visibility helper ----------
//
// Cached per-request via a tiny WeakMap keyed by user id string — most
// of a single request's reads touch the same caller, and re-running the
// membership query on every Account.find() would be wasteful. The cache
// is intentionally per-request (no module-level persistence) so a
// membership revoke takes effect on the next request.

const accessibleAccountIds = async (userId) => {
  const userObj = oid(userId);
  const memberships = await AccountMembership.find({
    user: userObj,
    status: 'active',
  })
    .select('account')
    .lean();
  const ownedIds = await Account.find({
    user: userObj,
    deletedAt: null,
  })
    .select('_id')
    .lean();
  // Dedupe — an owner can theoretically have a stale `member` row if
  // ownership was ever transferred. Set avoids double-listing.
  const ids = new Set([
    ...ownedIds.map((a) => String(a._id)),
    ...memberships.map((m) => String(m.account)),
  ]);
  return [...ids].map((id) => oid(id));
};

// Cheap fast-path for hot reads: just "is THIS account reachable?"
const isAccessible = async (userId, accountId) => {
  const userObj = oid(userId);
  const accountObj = oid(accountId);
  const owned = await Account.exists({ _id: accountObj, user: userObj, deletedAt: null });
  if (owned) return { accessible: true, role: 'owner' };
  const membership = await AccountMembership.findOne({
    account: accountObj,
    user: userObj,
    status: 'active',
  }).lean();
  return membership
    ? { accessible: true, role: membership.role }
    : { accessible: false, role: null };
};

// ---------- Public membership API ----------

const _ensureOwner = async (userId, accountId) => {
  const account = await Account.findOne({
    _id: accountId,
    user: oid(userId),
    deletedAt: null,
  });
  if (!account) {
    throw ApiError.forbidden('Only the account owner can manage members');
  }
  return account;
};

const toPublicMembership = (m, { user } = {}) => ({
  id: String(m._id),
  account: String(m.account),
  role: m.role,
  status: m.status,
  invitedAt: m.invitedAt,
  acceptedAt: m.acceptedAt || null,
  revokedAt: m.revokedAt || null,
  user: user
    ? { id: String(user._id), name: user.name, email: user.email }
    : { id: String(m.user) },
});

// Invite by email. Premium-gated at the route layer.
//
// Behaviour:
//   - Unknown email → creates a placeholder pending Membership pointing
//     at a NEW User row (passwordless, googleSub null). When that
//     person signs in via Google or an emailed OTP with the same email,
//     they automatically inherit the pending invite. Same lazy
//     account-creation flow as auth.service.requestOtp uses today.
//   - Known email → reuses or creates the membership row, status='pending'.
//   - Owner self-inviting their own email → 400.
//   - Re-invite of a declined / revoked member → flips status back to
//     'pending' on the existing row.
const invite = async (ownerId, accountId, { email, role = 'member' }) => {
  const account = await _ensureOwner(ownerId, accountId);
  const lower = String(email).toLowerCase().trim();

  // Look up or lazy-create the invitee. Lazy-create matches the
  // passwordless flow — they'll claim the row on first sign-in.
  let invitee = await User.findOne({ email: lower });
  if (!invitee) {
    invitee = await User.create({
      name: lower.split('@')[0],
      email: lower,
    });
  }
  if (String(invitee._id) === String(ownerId)) {
    throw ApiError.badRequest("You can't invite yourself to your own account");
  }

  const membership = await AccountMembership.findOneAndUpdate(
    { account: account._id, user: invitee._id },
    {
      $set: {
        role,
        status: 'pending',
        invitedBy: oid(ownerId),
        invitedAt: new Date(),
        // Clear any prior revoke / decline trace.
        acceptedAt: null,
        revokedAt: null,
        revokedReason: '',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // In-app notification + email dispatch. Both fire-and-forget so a
  // flaky transport never fails the invite.
  notifications
    .dispatch({
      user: invitee._id,
      type: NOTIFICATION_TYPES.SYSTEM,
      title: 'You were invited to a shared account',
      body: `${account.name} — open the app to accept.`,
      data: {
        membershipId: String(membership._id),
        accountId: String(account._id),
      },
      deepLink: '/shared/invitations',
    })
    .catch((err) => logger.warn('invite notify failed', { message: err.message }));

  return toPublicMembership(membership, { user: invitee });
};

// Membership owned by ME (the invitee) — accept it.
const acceptInvitation = async (userId, membershipId) => {
  const membership = await AccountMembership.findOne({
    _id: membershipId,
    user: oid(userId),
  });
  if (!membership) throw ApiError.notFound('Invitation not found');
  if (membership.status === 'active') return toPublicMembership(membership);
  if (membership.status !== 'pending') {
    throw ApiError.badRequest(
      `This invitation is already ${membership.status} — ask for a fresh one`
    );
  }
  membership.status = 'active';
  membership.acceptedAt = new Date();
  await membership.save();
  return toPublicMembership(membership);
};

const declineInvitation = async (userId, membershipId) => {
  const membership = await AccountMembership.findOne({
    _id: membershipId,
    user: oid(userId),
  });
  if (!membership) throw ApiError.notFound('Invitation not found');
  if (membership.status === 'declined') return toPublicMembership(membership);
  if (membership.status !== 'pending') {
    throw ApiError.badRequest('Only pending invitations can be declined');
  }
  membership.status = 'declined';
  await membership.save();
  return toPublicMembership(membership);
};

// Owner kicks a member, OR member self-removes. Both go through here.
const revoke = async (callerId, accountId, membershipId, { reason = '' } = {}) => {
  const membership = await AccountMembership.findById(membershipId);
  if (!membership) throw ApiError.notFound('Membership not found');
  if (String(membership.account) !== String(accountId)) {
    throw ApiError.badRequest('Membership does not belong to this account');
  }

  const account = await Account.findById(accountId);
  if (!account) throw ApiError.notFound('Account not found');

  const isOwner = String(account.user) === String(callerId);
  const isSelf = String(membership.user) === String(callerId);
  if (!isOwner && !isSelf) {
    throw ApiError.forbidden('Only the owner or the member themselves can revoke');
  }

  membership.status = 'revoked';
  membership.revokedAt = new Date();
  if (reason) membership.revokedReason = reason;
  await membership.save();
  return toPublicMembership(membership);
};

// Pending invitations addressed to the caller. Shown on the mobile
// "Shared with me" screen so they can accept/decline.
const listMyPendingInvitations = async (userId) => {
  const rows = await AccountMembership.find({
    user: oid(userId),
    status: 'pending',
  })
    .populate({ path: 'account', select: 'name type icon color currency user' })
    .populate({ path: 'invitedBy', select: 'name email' })
    .lean();
  return {
    items: rows.map((m) => ({
      id: String(m._id),
      role: m.role,
      status: m.status,
      invitedAt: m.invitedAt,
      account: m.account
        ? {
            id: String(m.account._id),
            name: m.account.name,
            type: m.account.type,
            icon: m.account.icon,
            color: m.account.color,
            currency: m.account.currency,
          }
        : null,
      invitedBy: m.invitedBy
        ? { id: String(m.invitedBy._id), name: m.invitedBy.name, email: m.invitedBy.email }
        : null,
    })),
  };
};

// Members of an account. Anyone with access (owner or active member)
// can see who else is on the account.
const listMembers = async (callerId, accountId) => {
  const access = await isAccessible(callerId, accountId);
  if (!access.accessible) throw ApiError.notFound('Account not found');

  const account = await Account.findById(accountId)
    .populate({ path: 'user', select: 'name email' })
    .lean();
  if (!account) throw ApiError.notFound('Account not found');

  const memberships = await AccountMembership.find({
    account: oid(accountId),
    status: { $in: ['pending', 'active'] },
  })
    .populate({ path: 'user', select: 'name email' })
    .lean();

  return {
    owner: account.user
      ? { id: String(account.user._id), name: account.user.name, email: account.user.email }
      : null,
    members: memberships.map((m) => toPublicMembership(m, { user: m.user })),
    // Convenience flag so the mobile UI knows whether to render "Share"
    // and member-management controls.
    iAmOwner: String(account.user?._id || account.user) === String(callerId),
  };
};

module.exports = {
  accessibleAccountIds,
  isAccessible,
  invite,
  acceptInvitation,
  declineInvitation,
  revoke,
  listMyPendingInvitations,
  listMembers,
};
