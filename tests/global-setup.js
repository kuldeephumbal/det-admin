// Jest globalSetup — start an in-memory Mongo once for the whole test run.
// Subsequent setup.js per-test connects mongoose to it and wipes between tests.

const { MongoMemoryServer } = require('mongodb-memory-server');

module.exports = async () => {
  const server = await MongoMemoryServer.create();
  process.env.NODE_ENV = 'test';
  process.env.MONGO_URI = server.getUri();
  process.env.JWT_ACCESS_SECRET = 'test_access_secret';
  process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  process.env.BCRYPT_SALT_ROUNDS = '4'; // fast bcrypt for tests
  process.env.RATE_LIMIT_MAX = '100000'; // effectively off
  process.env.CRON_SECRET = 'test_cron_secret';
  process.env.LOG_LEVEL = 'error';

  // Stash the handle so globalTeardown can stop it cleanly.
  global.__MONGO__ = server;
};
