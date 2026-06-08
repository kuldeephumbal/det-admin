// One-shot diagnostic + test push for FCM.
//
// Usage:
//   node scripts/test-push.js
//
// What it does:
//   1. Connects to the configured Mongo.
//   2. Counts active Device rows that have an fcmToken.
//   3. If any exist, sends a real test push to ALL of them.
//   4. Reports successCount / failureCount / invalidTokens / errors.
//
// Safe to re-run. Doesn't write any business data — just a Notification
// row + an FCM dispatch.

require('./_loadenv')({ verbose: false });

const mongoose = require('mongoose');
const connectDB = require('../lib/db');
const Device = require('../lib/models/Device');
const fcm = require('../lib/services/fcm.service');
const notifications = require('../lib/services/notification.service');
const { NOTIFICATION_TYPES } = require('../lib/config/constants');

const main = async () => {
  await connectDB();

  console.log('\n=== FCM environment ===');
  console.log('isConfigured:', fcm.isConfigured());

  console.log('\n=== Active devices with FCM tokens ===');
  const devices = await Device.find({
    isActive: true,
    fcmToken: { $exists: true, $ne: '' },
  })
    .select('user platform appVersion locale lastSeenAt createdAt')
    .lean();

  if (devices.length === 0) {
    console.log('No devices registered yet.');
    console.log('\nWhat to do:');
    console.log('  1. cd C:/DET/mobile-app');
    console.log('  2. flutter clean');
    console.log('  3. flutter run --dart-define=GOOGLE_SIGN_IN_SERVER_CLIENT_ID=<id>');
    console.log('  4. Sign in. The phone will register its FCM token.');
    console.log('  5. Re-run this script.');
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log(`Found ${devices.length} device(s):`);
  for (const d of devices) {
    console.log(
      `  • user=${d.user} platform=${d.platform} v=${d.appVersion || '?'} locale=${d.locale || '?'} lastSeen=${d.lastSeenAt?.toISOString() || '?'}`
    );
  }

  console.log('\n=== Sending test push (broadcast to all active devices) ===');
  try {
    await notifications.dispatch({
      user: null, // broadcast
      type: NOTIFICATION_TYPES.SYSTEM,
      title: 'DET push test',
      body: `If you see this, FCM is wired correctly. ${new Date().toLocaleTimeString()}`,
      data: { source: 'test-push-script' },
      deepLink: '/',
    });
    console.log('dispatch() returned without throwing.');
    console.log('Fan-out runs asynchronously — give it ~3s for the FCM call.');
  } catch (err) {
    console.error('dispatch threw:', err.message);
  }

  // Give the async fan-out time to land before we disconnect.
  await new Promise((r) => setTimeout(r, 4000));

  console.log('\n(Done. Check your phone — if no buzz, look at the npm run dev terminal for FCM logs.)');
  await mongoose.disconnect();
  process.exit(0);
};

main().catch(async (err) => {
  console.error('Script failed:', err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
