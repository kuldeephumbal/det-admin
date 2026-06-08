// Quick MongoDB connectivity diagnostic.
//
//   node scripts/db-check.js
//
// Reads .env.local then .env, attempts to connect using your MONGO_URI,
// runs a tiny ping, and reports each step in plain English. Designed to
// catch the most common "I switched to Atlas and it doesn't connect"
// issues before they bleed into the app UI.

require('./_loadenv')({ verbose: true });

const uri = process.env.MONGO_URI;

if (!uri) {
  console.error('\n✖ MONGO_URI is not set.');
  console.error('  Create a .env.local file in the project root with:');
  console.error('    MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/det?retryWrites=true&w=majority');
  process.exit(2);
}

// Mask the password so logs are safe to paste.
const masked = uri.replace(/:\/\/([^:]+):([^@]+)@/, (_, u) => `://${u}:***@`);
console.log(`✓ MONGO_URI present: ${masked}`);

// Quick structural checks before we even try to connect.
if (uri.includes('127.0.0.1') || uri.includes('localhost')) {
  console.log('ℹ URI points at LOCAL MongoDB. Make sure mongod is running on that host.');
}
if (!uri.startsWith('mongodb+srv://') && !uri.startsWith('mongodb://')) {
  console.error('\n✖ MONGO_URI looks malformed — must start with mongodb:// or mongodb+srv://');
  process.exit(2);
}
if (uri.startsWith('mongodb+srv://') && !/\/[a-zA-Z0-9_-]+(\?|$)/.test(uri)) {
  console.warn('⚠ No database name in the URI. App will use Atlas default. Add /det before the ?');
}

const mongoose = require('mongoose');
mongoose.set('strictQuery', true);

const start = Date.now();
console.log('… connecting (timeout 10s) …');

mongoose
  .connect(uri, { serverSelectionTimeoutMS: 10_000 })
  .then(async (conn) => {
    const ms = Date.now() - start;
    console.log(`✓ connected in ${ms}ms`);
    console.log(`  host:   ${conn.connection.host}`);
    console.log(`  db:     ${conn.connection.name}`);

    const pingStart = Date.now();
    const admin = conn.connection.db.admin();
    const ping = await admin.ping();
    console.log(`✓ ping ok in ${Date.now() - pingStart}ms`, ping);

    const collections = await conn.connection.db.listCollections().toArray();
    console.log(`✓ ${collections.length} collection(s):`, collections.map((c) => c.name).join(', ') || '(empty)');

    await mongoose.disconnect();
    console.log('\nAll good. Restart the dev server (Ctrl+C, then npm run dev).');
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(`\n✖ connection failed (${Date.now() - start}ms)`);
    console.error(`  name:    ${err.name}`);
    console.error(`  message: ${err.message}`);

    const msg = (err.message || '').toLowerCase();

    if (msg.includes('bad auth') || msg.includes('authentication failed')) {
      console.error(`
  → Atlas username or password is wrong. Open Atlas → Database Access,
    confirm the user, and reset the password if needed. Re-encode any
    special characters in the password (% → %25, @ → %40, etc.).`);
    } else if (msg.includes("ip that isn't whitelisted") || msg.includes('not allowed')) {
      console.error(`
  → Your IP is not in Atlas's allowlist. Atlas → Network Access →
    Add IP Address. For dev, use "Allow access from anywhere"
    (0.0.0.0/0) or click "Add Current IP Address".`);
    } else if (err.name === 'MongooseServerSelectionError' && msg.includes('server selection timed out')) {
      console.error(`
  → Couldn't even reach any cluster member. Most common causes:
    1. Atlas Network Access doesn't include your IP. Add it.
    2. Atlas free-tier cluster is paused — open the Atlas UI to wake it.
    3. Cluster hostname in MONGO_URI is wrong (typo or old cluster).`);
    } else if (msg.includes('econnrefused')) {
      console.error(`
  → Nothing is listening on the address in MONGO_URI. If the URI starts
    with mongodb://127.0.0.1:27017, you haven't switched to Atlas yet —
    update MONGO_URI in .env.local (NOT .env.example).`);
    } else if (msg.includes('getaddrinfo') || msg.includes('enotfound')) {
      console.error(`
  → DNS lookup for the cluster hostname failed. Check spelling in
    MONGO_URI. SRV form is: mongodb+srv://USER:PASS@CLUSTER.mongodb.net/...`);
    } else {
      console.error('  → No specific guidance for this error code. Paste it for help.');
    }

    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
