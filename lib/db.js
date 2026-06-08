// HMR-safe Mongoose connection. In Next.js dev, modules can be re-evaluated
// on every request, so we cache the connection promise on a global to avoid
// opening a new pool per HMR reload.

const mongoose = require('mongoose');
const env = require('./config/env');
const logger = require('./utils/logger');

mongoose.set('strictQuery', true);

const cacheKey = '__det_mongoose__';
let cached = global[cacheKey];
if (!cached) {
  cached = global[cacheKey] = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(env.MONGO_URI, {
        autoIndex: env.NODE_ENV !== 'production',
        serverSelectionTimeoutMS: 10_000,
        maxPoolSize: 50,
        bufferCommands: false,
      })
      .then((m) => {
        logger.info(`MongoDB connected: ${m.connection.host}/${m.connection.name}`);
        m.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
        m.connection.on('reconnected', () => logger.info('MongoDB reconnected'));
        m.connection.on('error', (err) => logger.error('MongoDB error', { message: err.message }));
        return m;
      })
      .catch((err) => {
        cached.promise = null;
        throw err;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

module.exports = connectDB;
module.exports.connectDB = connectDB;
