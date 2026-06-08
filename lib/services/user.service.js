const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { sanitize } = require('./auth.service');

const getMe = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');
  return sanitize(user);
};

const updateMe = async (userId, patch) => {
  const allowed = ['name', 'phone', 'avatarUrl'];
  const update = {};
  for (const k of allowed) {
    if (patch[k] !== undefined) update[k] = patch[k] === '' ? null : patch[k];
  }
  if (patch.preferences) {
    for (const [k, v] of Object.entries(patch.preferences)) {
      if (k === 'notifications' && v && typeof v === 'object') {
        for (const [nk, nv] of Object.entries(v)) {
          update[`preferences.notifications.${nk}`] = nv;
        }
      } else {
        update[`preferences.${k}`] = v;
      }
    }
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: update },
    { new: true, runValidators: true, context: 'query' }
  );
  if (!user) throw ApiError.notFound('User not found');
  return sanitize(user);
};

module.exports = { getMe, updateMe };
