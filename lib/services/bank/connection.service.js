// Bank connection lifecycle service (CRUD around BankConnection).
//
// The sync orchestration lives in sync.service; this module handles
// init → exchange → list → disconnect.

const mongoose = require('mongoose');
const { BankConnection } = require('../../models/BankConnection');
const User = require('../../models/User');
const ApiError = require('../../utils/ApiError');
const logger = require('../../utils/logger');
const bank = require('./index');
const { sealToken } = require('./sync.service');

const oid = (id) => new mongoose.Types.ObjectId(String(id));

const toPublic = (c) => ({
  id: String(c._id),
  provider: c.provider,
  bankName: c.bankName || '',
  accountMask: c.accountMask || '',
  currency: c.currency,
  status: c.status,
  lastSyncedAt: c.lastSyncedAt || null,
  lastError: c.lastError || '',
  connectedAt: c.connectedAt,
  tokenExpiresAt: c.tokenExpiresAt || null,
});

const initConnection = async (userId, { provider } = {}) => {
  const user = await User.findById(userId).lean();
  if (!user) throw ApiError.unauthorized();
  const { adapter, name } = bank.pickForUser(user, provider);
  const result = await adapter.initConnection({ userId });
  return { ...result, provider: name };
};

const exchangePublicToken = async (userId, { provider, publicToken }) => {
  const user = await User.findById(userId).lean();
  if (!user) throw ApiError.unauthorized();
  const { adapter, name } = bank.pickForUser(user, provider);
  const exchanged = await adapter.exchangePublicToken({ publicToken, userId });

  const encrypted = sealToken(exchanged.accessToken);
  const conn = await BankConnection.findOneAndUpdate(
    { user: oid(userId), provider: name, providerAccountId: exchanged.providerAccountId },
    {
      $set: {
        accessTokenEncrypted: encrypted,
        bankName: exchanged.bankName || '',
        accountMask: exchanged.accountMask || '',
        currency: exchanged.currency || user.preferences?.currency || 'INR',
        status: 'active',
        tokenExpiresAt: exchanged.tokenExpiresAt || null,
        lastError: '',
      },
      $setOnInsert: {
        user: oid(userId),
        provider: name,
        providerAccountId: exchanged.providerAccountId,
        connectedAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return toPublic(conn);
};

const list = async (userId) => {
  const rows = await BankConnection.find({ user: oid(userId) }).sort({ connectedAt: -1 }).lean();
  return { items: rows.map(toPublic) };
};

const disconnect = async (userId, connectionId) => {
  const conn = await BankConnection.findOne({
    _id: connectionId,
    user: oid(userId),
  }).select('+accessTokenEncrypted');
  if (!conn) throw ApiError.notFound('Bank connection not found');

  try {
    const { adapter } = bank.get(conn.provider);
    const { unsealToken } = require('./sync.service');
    await adapter.disconnect({ accessToken: unsealToken(conn.accessTokenEncrypted) });
  } catch (err) {
    logger.warn('bank.disconnect provider call failed; marking local disconnected anyway', {
      connectionId: String(conn._id),
      message: err.message,
    });
  }

  conn.status = 'disconnected';
  // Wipe the token blob — once disconnected, we should not hold it.
  conn.accessTokenEncrypted = '';
  await conn.save();
  return toPublic(conn);
};

module.exports = { initConnection, exchangePublicToken, list, disconnect };
