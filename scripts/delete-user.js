// One-shot user-purge script. Cascade-deletes a single user and every
// row that belongs to them across the user-scoped collections.
//
//   node scripts/delete-user.js <email>

require('./_loadenv')();
const mongoose = require('mongoose');

const email = (process.argv[2] || '').trim().toLowerCase();
if (!email) {
  console.error('Usage: node scripts/delete-user.js <email>');
  process.exit(2);
}

const COLS = [
  'expenses',
  'subscriptions',
  'refreshtokens',
  'budgets',
  'categories',
  'recurringexpenses',
  'notifications',
];

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const user = await db.collection('users').findOne({ email });
  if (!user) {
    console.log(`No user found with email: ${email}`);
    await mongoose.disconnect();
    process.exit(0);
  }

  const uid = user._id;
  console.log('Found user:');
  console.log({
    id: String(uid),
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
  });

  const before = {};
  for (const c of COLS) {
    before[c] = await db.collection(c).countDocuments({ user: uid });
  }
  console.log('Related rows:', before);

  const deleted = {};
  for (const c of COLS) {
    deleted[c] = (await db.collection(c).deleteMany({ user: uid })).deletedCount;
  }
  deleted.user = (await db.collection('users').deleteOne({ _id: uid })).deletedCount;
  console.log('Deleted:', deleted);

  await mongoose.disconnect();
  process.exit(0);
};

run().catch(async (err) => {
  console.error('delete-user failed:', err.message, err.stack);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
