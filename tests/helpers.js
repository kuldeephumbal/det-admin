// Shared test helpers. Connects mongoose lazily, creates fixtures, etc.

const mongoose = require('mongoose');
const connectDB = require('../lib/db');
const User = require('../lib/models/User');
const Category = require('../lib/models/Category');
const { DEFAULT_CATEGORIES } = require('../lib/config/constants');

let connected = false;

async function ensureDb() {
  if (connected && mongoose.connection.readyState === 1) return;
  await connectDB();
  connected = true;
}

async function makeUser(overrides = {}) {
  await ensureDb();
  return User.create({
    name: 'Test User',
    email: `user-${Math.random().toString(36).slice(2, 9)}@example.com`,
    password: 'Passw0rd!',
    ...overrides,
  });
}

async function makeAdmin(overrides = {}) {
  return makeUser({ role: 'admin', ...overrides });
}

async function seedDefaultCategories() {
  await ensureDb();
  for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
    const def = DEFAULT_CATEGORIES[i];
    await Category.findOneAndUpdate(
      { user: null, isDefault: true, name: def.name },
      { $setOnInsert: { ...def, user: null, isDefault: true, sortOrder: i } },
      { upsert: true, new: true }
    );
  }
}

async function makeCategory(user, overrides = {}) {
  await ensureDb();
  return Category.create({
    user: user?._id ?? null,
    name: overrides.name || 'TestCat',
    icon: 'category',
    color: '#FF0000',
    isDefault: !user,
    ...overrides,
  });
}

module.exports = { ensureDb, makeUser, makeAdmin, makeCategory, seedDefaultCategories };
