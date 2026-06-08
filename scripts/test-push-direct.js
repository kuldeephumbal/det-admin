// Direct FCM test — calls fcm.sendToTokens synchronously so we see the
// real successCount / failureCount / lastError instead of fire-and-forget.
//
//   node scripts/test-push-direct.js

require('./_loadenv')({ verbose: false });

const mongoose = require('mongoose');
const connectDB = require('../lib/db');
const Device = require('../lib/models/Device');
const fcm = require('../lib/services/fcm.service');

const main = async () => {
  await connectDB();

  console.log('FCM configured:', fcm.isConfigured());

  const devices = await Device.find({
    isActive: true,
    fcmToken: { $exists: true, $ne: '' },
  })
    .select('fcmToken user')
    .lean();

  if (devices.length === 0) {
    console.log('No devices — sign in on phone first.');
    await mongoose.disconnect();
    process.exit(0);
  }

  const tokens = devices.map((d) => d.fcmToken).filter(Boolean);
  console.log(`Sending direct FCM to ${tokens.length} token(s)…`);
  console.log(`  token prefix: ${tokens[0].slice(0, 20)}… (length ${tokens[0].length})`);

  const result = await fcm.sendToTokens(tokens, {
    title: 'DET — direct test',
    body: `Direct FCM call at ${new Date().toLocaleTimeString()}`,
    data: { source: 'test-push-direct' },
    deepLink: '/',
  });

  console.log('\nResult:');
  console.log('  successCount:', result.successCount);
  console.log('  failureCount:', result.failureCount);
  console.log('  invalidTokens:', result.invalidTokens?.length || 0);
  console.log('  lastError:', result.lastError || '(none)');
  if (result.skipped) console.log('  skipped:', result.skipped);

  await mongoose.disconnect();
  process.exit(0);
};

main().catch(async (err) => {
  console.error('Direct push failed:');
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
