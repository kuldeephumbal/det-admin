// Create or promote an admin user.
//
//   node scripts/create-admin.js <email> <password> [name]
//
// Examples:
//   node scripts/create-admin.js humbalkuldeep54@gmail.com 'Admin@123'
//   node scripts/create-admin.js me@x.com 'StrongPass1' 'Kuldeep'
//
// Behavior:
//   - If the email is unknown, creates a new active admin user + free Subscription.
//   - If the email already exists, promotes the user to admin, marks them
//     active, and resets the password to the one passed in.
//   - The password goes through the User model's pre-save hook, so it's
//     bcrypt-hashed exactly the same way registration does it.

require('./_loadenv')({ verbose: true });

const mongoose = require('mongoose');
const connectDB = require('../lib/db');
const User = require('../lib/models/User');
const Subscription = require('../lib/models/Subscription');
const { USER_STATUS, SUBSCRIPTION_PLANS } = require('../lib/config/constants');

const [, , emailArg, passwordArg, ...nameArgs] = process.argv;

if (!emailArg || !passwordArg) {
  console.error('Usage: node scripts/create-admin.js <email> <password> [name]');
  process.exit(2);
}

const email = String(emailArg).trim().toLowerCase();
const password = String(passwordArg);
const name = nameArgs.length ? nameArgs.join(' ') : 'Admin';

// Basic guardrails matching the Joi schema in the public registration path.
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Refusing — email looks malformed:', email);
  process.exit(2);
}
if (password.length < 8) {
  console.error('Refusing — password must be at least 8 characters.');
  process.exit(2);
}

const run = async () => {
  await connectDB();

  let user = await User.findOne({ email }).select('+status +password');
  if (user) {
    console.log(`Updating existing user ${email} → admin / active / new password.`);
    user.role = 'admin';
    user.status = USER_STATUS.ACTIVE;
    user.password = password; // pre-save hook will bcrypt this
    if (user.deletedAt) user.deletedAt = null;
    await user.save();
  } else {
    console.log(`Creating new admin user ${email}.`);
    user = await User.create({
      name,
      email,
      password, // pre-save hook bcrypts
      role: 'admin',
      status: USER_STATUS.ACTIVE,
    });
    await Subscription.create({
      user: user._id,
      plan: SUBSCRIPTION_PLANS.FREE,
      startedAt: new Date(),
    });
  }

  console.log('');
  console.log('Done.');
  console.log(`  id:    ${user._id}`);
  console.log(`  name:  ${user.name}`);
  console.log(`  email: ${user.email}`);
  console.log(`  role:  ${user.role}`);
  console.log('');
  console.log('Sign in at /admin/login with the credentials you provided.');

  await mongoose.disconnect();
  process.exit(0);
};

run().catch(async (err) => {
  console.error('create-admin failed:', err.message);
  if (err.stack) console.error(err.stack);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
