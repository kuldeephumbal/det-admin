// Split-expenses groups: CRUD, membership/invites (existing-user add,
// email lazy-create, phone+SMS token invite), and settlements. Mirrors
// sharing.service.js conventions (oid, toPublic serializers, ApiError,
// fire-and-forget notifications).

const crypto = require('crypto');
const mongoose = require('mongoose');
const Group = require('../models/Group');
const GroupMember = require('../models/GroupMember');
const User = require('../models/User');
const Settlement = require('../models/Settlement');
const ApiError = require('../utils/ApiError');
const { parsePagination } = require('../utils/pagination');
const { normalize } = require('../utils/phone');
const { sendSms } = require('../utils/sms');
const notifications = require('./notification.service');
const { NOTIFICATION_TYPES } = require('../config/constants');

const oid = (id) => new mongoose.Types.ObjectId(String(id));
const sha256 = (raw) => crypto.createHash('sha256').update(raw).digest('hex');
const INVITE_TTL_DAYS = 30;
const INVITE_BASE = (process.env.APP_INVITE_BASE_URL || 'https://det-admin.onrender.com/i').replace(/\/$/, '');

// ---- serializers -----------------------------------------------------

const toPublicGroup = (g, extra = {}) => ({
  id: String(g._id),
  name: g.name,
  description: g.description || '',
  currency: g.currency,
  simplifyDebts: !!g.simplifyDebts,
  owner: String(g.owner),
  createdAt: g.createdAt,
  updatedAt: g.updatedAt,
  ...extra,
});

const toPublicMember = (m, { user } = {}) => ({
  id: String(m._id),
  group: String(m.group),
  role: m.role,
  status: m.status,
  phone: m.phone || null,
  displayName: m.displayName || (user ? user.name : ''),
  invitedAt: m.invitedAt,
  acceptedAt: m.acceptedAt || null,
  user: m.user
    ? (user ? { id: String(user._id), name: user.name, email: user.email } : { id: String(m.user) })
    : null,
});

const toPublicSettlement = (s) => ({
  id: String(s._id),
  group: String(s.group),
  from: String(s.from),
  to: String(s.to),
  amount: s.amount,
  currency: s.currency,
  note: s.note || '',
  createdBy: String(s.createdBy),
  createdAt: s.createdAt,
});

// ---- access helpers (exported, reused by expense service) -----------

// Owner or active member may access the group. Throws otherwise.
const assertAccess = async (userId, groupId) => {
  const group = await Group.findOne({ _id: groupId, deletedAt: null });
  if (!group) throw ApiError.notFound('Group not found');
  if (String(group.owner) === String(userId)) return { group, role: 'owner' };
  const m = await GroupMember.findOne({
    group: groupId,
    user: oid(userId),
    status: 'active',
  }).lean();
  if (!m) throw ApiError.forbidden('You are not a member of this group');
  return { group, role: m.role };
};

// Set of active member userId strings (the owner is also stored as an
// active GroupMember row, so this covers everyone).
const memberUserIds = async (groupId) => {
  const ms = await GroupMember.find({ group: groupId, status: 'active', user: { $ne: null } })
    .select('user')
    .lean();
  return new Set(ms.map((m) => String(m.user)));
};

// ---- groups ----------------------------------------------------------

const listGroups = async (userId, q = {}) => {
  const { page, limit, skip } = parsePagination(q);
  const myMemberships = await GroupMember.find({ user: oid(userId), status: 'active' })
    .select('group')
    .lean();
  const ids = myMemberships.map((m) => m.group);
  const filter = { deletedAt: null, $or: [{ owner: oid(userId) }, { _id: { $in: ids } }] };

  const [items, total] = await Promise.all([
    Group.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
    Group.countDocuments(filter),
  ]);

  const counts = await GroupMember.aggregate([
    { $match: { group: { $in: items.map((g) => g._id) }, status: 'active' } },
    { $group: { _id: '$group', n: { $sum: 1 } } },
  ]);
  const cmap = {};
  counts.forEach((c) => { cmap[String(c._id)] = c.n; });

  return {
    items: items.map((g) => toPublicGroup(g, { memberCount: cmap[String(g._id)] || 1 })),
    page,
    limit,
    total,
  };
};

const createGroup = async (userId, body) => {
  const group = await Group.create({
    owner: oid(userId),
    name: body.name,
    description: body.description || '',
    currency: body.currency || 'INR',
  });
  // Owner is also an active member row, so member queries are uniform.
  await GroupMember.create({
    group: group._id,
    user: oid(userId),
    role: 'owner',
    status: 'active',
    acceptedAt: new Date(),
  });
  return toPublicGroup(group, { memberCount: 1 });
};

const getGroup = async (userId, groupId) => {
  const { group, role } = await assertAccess(userId, groupId);
  return toPublicGroup(group, { role });
};

const updateGroup = async (userId, groupId, patch) => {
  const { group, role } = await assertAccess(userId, groupId);
  if (role !== 'owner') throw ApiError.forbidden('Only the owner can edit the group');
  for (const k of ['name', 'description', 'currency', 'simplifyDebts']) {
    if (patch[k] !== undefined) group[k] = patch[k];
  }
  await group.save();
  return toPublicGroup(group);
};

const deleteGroup = async (userId, groupId) => {
  const { group, role } = await assertAccess(userId, groupId);
  if (role !== 'owner') throw ApiError.forbidden('Only the owner can delete the group');
  group.deletedAt = new Date();
  await group.save();
};

// ---- members / invites ----------------------------------------------

const listMembers = async (userId, groupId) => {
  await assertAccess(userId, groupId);
  const members = await GroupMember.find({ group: groupId, status: { $in: ['active', 'pending'] } })
    .populate({ path: 'user', select: 'name email avatarUrl' })
    .sort({ createdAt: 1 })
    .lean();
  return members.map((m) => toPublicMember(m, { user: m.user }));
};

// Any active member can add people (Splitwise-style). Existing DET users
// (matched by email or normalized phone) are added active immediately +
// notified. An email that's unknown lazy-creates a user (same as
// sharing.service). A phone with no matching user creates a pending
// phone-only row + SMS invite carrying a one-shot token.
const invite = async (userId, groupId, body) => {
  const { group } = await assertAccess(userId, groupId);
  const { phone, email, displayName = '', role = 'member' } = body;

  let targetUser = null;
  let normPhone = null;

  if (email) {
    const lower = String(email).toLowerCase().trim();
    targetUser = await User.findOne({ email: lower });
    if (!targetUser) targetUser = await User.create({ name: lower.split('@')[0], email: lower });
  } else if (phone) {
    normPhone = normalize(phone);
    if (!normPhone) throw ApiError.badRequest('That phone number could not be understood');
    targetUser = await User.findOne({ phoneNormalized: normPhone });
  }

  if (targetUser) {
    if (String(targetUser._id) === String(userId)) {
      throw ApiError.badRequest("You're already in this group");
    }
    const m = await GroupMember.findOneAndUpdate(
      { group: groupId, user: targetUser._id },
      {
        $set: {
          role,
          status: 'active',
          invitedBy: oid(userId),
          invitedAt: new Date(),
          acceptedAt: new Date(),
          phone: normPhone || null,
          displayName,
          inviteTokenHash: null,
          inviteTokenExpires: null,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    notifications
      .dispatch({
        user: targetUser._id,
        type: NOTIFICATION_TYPES.SPLIT_INVITE,
        title: 'You were added to a group',
        body: `${group.name} — open Split expenses to see it.`,
        data: { groupId: String(groupId), memberId: String(m._id) },
        deepLink: `/groups/${groupId}`,
      })
      .catch(() => {});
    return toPublicMember(m, { user: targetUser });
  }

  // Phone with no DET user yet → pending phone-only row + SMS token.
  const rawToken = crypto.randomBytes(32).toString('hex');
  const m = await GroupMember.findOneAndUpdate(
    { group: groupId, phone: normPhone },
    {
      $set: {
        role,
        status: 'pending',
        user: null,
        invitedBy: oid(userId),
        invitedAt: new Date(),
        acceptedAt: null,
        displayName,
        inviteTokenHash: sha256(rawToken),
        inviteTokenExpires: new Date(Date.now() + INVITE_TTL_DAYS * 86400000),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  sendSms({
    to: normPhone,
    body: `${displayName ? '' : ''}You've been invited to "${group.name}" on DET. Join: ${INVITE_BASE}/${rawToken}`,
  }).catch(() => {});
  return toPublicMember(m, {});
};

// Recipient of an SMS invite signs up, then redeems the token to join.
const redeemInvite = async (userId, token) => {
  const m = await GroupMember.findOne({ inviteTokenHash: sha256(token), status: 'pending' });
  if (!m || (m.inviteTokenExpires && m.inviteTokenExpires.getTime() < Date.now())) {
    throw new ApiError(410, 'This invite is invalid or expired', { code: 'INVITE_INVALID' });
  }
  m.user = oid(userId);
  m.status = 'active';
  m.acceptedAt = new Date();
  m.inviteTokenHash = null;
  m.inviteTokenExpires = null;
  await m.save();
  const group = await Group.findById(m.group).lean();
  return { group: group ? toPublicGroup(group) : null, membership: toPublicMember(m) };
};

const revokeMember = async (userId, groupId, memberId) => {
  const { group, role } = await assertAccess(userId, groupId);
  if (role !== 'owner') throw ApiError.forbidden('Only the owner can remove members');
  const m = await GroupMember.findOne({ _id: memberId, group: groupId });
  if (!m) throw ApiError.notFound('Member not found');
  if (m.user && String(m.user) === String(group.owner)) {
    throw ApiError.badRequest("The owner can't be removed");
  }
  m.status = 'revoked';
  m.revokedAt = new Date();
  await m.save();
};

// ---- settlements -----------------------------------------------------

const listSettlements = async (userId, groupId) => {
  await assertAccess(userId, groupId);
  const items = await Settlement.find({ group: groupId, deletedAt: null })
    .sort({ createdAt: -1 })
    .lean();
  return items.map(toPublicSettlement);
};

const createSettlement = async (userId, groupId, body) => {
  const { group } = await assertAccess(userId, groupId);
  if (String(body.from) === String(body.to)) {
    throw ApiError.badRequest('A settlement needs two different people');
  }
  const ids = await memberUserIds(groupId);
  if (!ids.has(String(body.from)) || !ids.has(String(body.to))) {
    throw ApiError.badRequest('Both people must be members of this group');
  }
  const s = await Settlement.create({
    group: groupId,
    from: oid(body.from),
    to: oid(body.to),
    amount: body.amount,
    currency: body.currency || group.currency,
    note: body.note || '',
    createdBy: oid(userId),
  });
  const notifyUser = String(body.from) === String(userId) ? body.to : body.from;
  notifications
    .dispatch({
      user: oid(notifyUser),
      type: NOTIFICATION_TYPES.SPLIT_SETTLEMENT,
      title: 'Payment recorded',
      body: `A settlement was recorded in ${group.name}.`,
      data: { groupId: String(groupId) },
      deepLink: `/groups/${groupId}`,
    })
    .catch(() => {});
  return toPublicSettlement(s);
};

const deleteSettlement = async (userId, groupId, settlementId) => {
  await assertAccess(userId, groupId);
  const s = await Settlement.findOne({ _id: settlementId, group: groupId, deletedAt: null });
  if (!s) throw ApiError.notFound('Settlement not found');
  s.deletedAt = new Date();
  await s.save();
};

module.exports = {
  assertAccess,
  memberUserIds,
  toPublicGroup,
  listGroups,
  createGroup,
  getGroup,
  updateGroup,
  deleteGroup,
  listMembers,
  invite,
  redeemInvite,
  revokeMember,
  listSettlements,
  createSettlement,
  deleteSettlement,
};
