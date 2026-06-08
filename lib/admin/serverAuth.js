// requireAdmin() — call this at the top of every admin Server Component
// page. Verifies the session cookie, loads the User from Mongo, and
// returns a sanitized object. Redirects to /admin/login on failure.

const { cookies } = require('next/headers');
const { redirect } = require('next/navigation');

const connectDB = require('../db');
const User = require('../models/User');
const { sessionCookieName, verifyAdminSession } = require('./session');
const { USER_STATUS } = require('../config/constants');

const requireAdmin = async () => {
  const store = await cookies();
  const token = store.get(sessionCookieName)?.value;

  if (!token) redirect('/admin/login');

  let decoded;
  try {
    decoded = verifyAdminSession(token);
  } catch (_) {
    redirect('/admin/login');
  }

  await connectDB();
  const user = await User.findById(decoded.sub).select('+status');
  if (!user || user.role !== 'admin' || user.status !== USER_STATUS.ACTIVE) {
    redirect('/admin/login');
  }

  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
  };
};

module.exports = { requireAdmin };
