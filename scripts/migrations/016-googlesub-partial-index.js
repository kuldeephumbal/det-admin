// Migration 016 — Rebuild the googleSub unique index as PARTIAL.
//
// The old index on `users.googleSub` was unique (and/or sparse). Because
// the schema writes `default: null` for every passwordless / magic-link
// user, those explicit nulls all landed in the unique index and the
// SECOND such user failed with E11000 "duplicate key googleSub: null".
// That broke magic-link + email/password signup for everyone after the
// first passwordless account.
//
// Fix: drop whatever googleSub index exists and recreate it as a partial
// unique index that only covers rows where googleSub is a string. Null
// rows are excluded entirely, so they never collide.
//
// Idempotent: records itself in `_migrations` and no-ops on re-run. Safe
// to run against production — it only rebuilds an index, touches no data.
//
//   Usage: node scripts/migrations/016-googlesub-partial-index.js

require('../_loadenv')({ verbose: false });

const mongoose = require('mongoose');
const connectDB = require('../../lib/db');
const logger = require('../../lib/utils/logger');

const NAME = '016-googlesub-partial-index';
const TARGET_KEY = { googleSub: 1 };
const TARGET_OPTS = {
  unique: true,
  partialFilterExpression: { googleSub: { $type: 'string' } },
};

const isSameKey = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const run = async () => {
  await connectDB();
  const Migrations = mongoose.connection.collection('_migrations');

  const prior = await Migrations.findOne({ name: NAME });
  if (prior) {
    logger.info(`Migration ${NAME} already applied at ${prior.appliedAt.toISOString()} — skipping`);
    await mongoose.disconnect();
    process.exit(0);
  }

  const start = Date.now();
  const users = mongoose.connection.collection('users');

  // Find any existing index keyed solely on googleSub and drop it
  // (regardless of its current name / sparse / unique flags).
  const existing = await users.indexes();
  const dropped = [];
  for (const idx of existing) {
    if (idx.name === '_id_') continue;
    if (isSameKey(idx.key, TARGET_KEY)) {
      await users.dropIndex(idx.name);
      dropped.push(idx.name);
      logger.info(`Dropped existing index ${idx.name}`, { key: idx.key, unique: idx.unique, sparse: idx.sparse });
    }
  }

  // Recreate as partial-unique. Build it explicitly named so future
  // audits can find it.
  await users.createIndex(TARGET_KEY, { ...TARGET_OPTS, name: 'googleSub_1' });
  logger.info('Created partial-unique index googleSub_1', TARGET_OPTS);

  const durationMs = Date.now() - start;
  await Migrations.insertOne({
    name: NAME,
    appliedAt: new Date(),
    durationMs,
    droppedIndexes: dropped,
  });

  logger.info(`Migration ${NAME} complete in ${durationMs}ms (dropped: ${dropped.join(', ') || 'none'})`);
  await mongoose.disconnect();
  process.exit(0);
};

run().catch(async (err) => {
  logger.error(`Migration ${NAME} failed`, { message: err.message, stack: err.stack });
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
