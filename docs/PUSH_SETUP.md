# DET — FCM push setup

End-to-end setup for Firebase Cloud Messaging push delivery. The code
on both sides is wired and shipped; this doc covers the once-per-env
configuration steps.

---

## Prerequisites

- A Google account (use the one tied to your Play Console).
- ~15 minutes.

---

## 1. Create the Firebase project

1. Open <https://console.firebase.google.com> → **Add project**.
2. Project name: `DET` (or `DET Prod` / `DET Staging` per env).
3. Disable Analytics for now (you can add it later; not needed for push).
4. Wait for project creation. The console drops you on the dashboard.

---

## 2. Add an Android app

1. In Firebase Console → Project overview → **Add app** → Android.
2. Package name: **`com.det.app`** (must match `applicationId` in
   `mobile-app/android/app/build.gradle.kts`).
3. App nickname: `DET Android`.
4. **Debug signing certificate SHA-1** — get it from your dev machine:
   ```powershell
   cd C:\DET\mobile-app\android
   .\gradlew signingReport
   ```
   Look for the `debug` variant's `SHA1:`. Paste it into Firebase.
   *(Add the release SHA-1 too once you have the upload keystore — see
   `docs/PLAYSTORE_LAUNCH.md` Phase B.)*
5. Download **`google-services.json`** and drop it into
   `C:\DET\mobile-app\android\app\google-services.json`.
6. Click through the remaining "add the plugin" steps in the wizard
   — they're already wired in our `build.gradle.kts`, no further code
   changes needed.

---

## 3. (Optional, for iOS later) Add an iOS app

Skip for v1.0.0 if you're shipping Android-only. When you do:

1. Add app → iOS. Bundle ID: `com.det.app`.
2. Download `GoogleService-Info.plist` → `mobile-app/ios/Runner/`.
3. Upload your APNs Authentication Key (`.p8` from Apple Developer
   account) under Project Settings → Cloud Messaging → Apple app
   configuration. This is what lets FCM relay to APNs.

---

## 4. Generate the service-account credentials (server side)

The server uses these credentials to call the FCM HTTP v1 API.

1. Firebase Console → Project Settings (cog icon) → **Service accounts**.
2. Click **Generate new private key** → download the JSON.
3. Base64-encode the entire file (single line, no wrapping):
   ```powershell
   $bytes = [IO.File]::ReadAllBytes("C:\path\to\downloaded-key.json")
   [Convert]::ToBase64String($bytes) | Set-Clipboard
   ```
   (The base64 string is now on your clipboard.)
4. Open `C:\DET\.env.local` and paste:
   ```
   FCM_CREDENTIALS_JSON=<the base64 string from step 3>
   FCM_PROJECT_ID=<your-firebase-project-id>
   ```
   `FCM_PROJECT_ID` is optional — the server falls back to the
   `project_id` field inside the JSON.

**Never commit the raw JSON or the base64 string to git.** Treat it
like a database password.

---

## 5. Verify on a real device

1. Restart the Next.js dev server so it picks up the new env vars.
2. From `C:\DET\mobile-app`, full reinstall the app on your phone:
   ```powershell
   flutter run --dart-define=GOOGLE_SIGN_IN_SERVER_CLIENT_ID=<your-web-client-id>
   ```
   (Hot reload won't pick up native FCM config — you need a full install.)
3. Open the app → sign in. The Flutter `PushService.registerCurrentDevice()`
   posts the FCM token to `POST /api/v1/devices`.
4. Test push end-to-end:
   - Open the admin panel (`/admin`) → Notifications → fire a test
     broadcast, OR
   - Set a budget and create an expense that crosses the threshold
     (triggers `budget.service.checkAndAlert` → `notification.dispatch`).
5. The phone should buzz / show the system notification (when app is
   backgrounded) or a snackbar at the bottom (when foregrounded). Tap
   "OPEN" on the snackbar → routes to the deepLink baked into the
   notification.

---

## 6. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Server log: `fcm: firebase-admin not installed` | `npm install` skipped firebase-admin | `cd C:\DET && npm install firebase-admin` |
| Server log: `fcm: FCM_CREDENTIALS_JSON is not valid base64-encoded JSON` | Encoding wrong / line breaks | Re-encode with the PowerShell snippet in §4 |
| Server log: `Push skipped — SDK not configured` | Env var blank | Set `FCM_CREDENTIALS_JSON` and restart `npm run dev` |
| Mobile log: `[push] Firebase init skipped` | `google-services.json` missing | Drop it into `mobile-app/android/app/` and `flutter clean && flutter run` |
| No system notification but server logs `successCount: 1` | App was in foreground | Expected. Foreground messages show as a snackbar; background/killed show as system tray notifications |
| `messaging/registration-token-not-registered` | Stale token | Already auto-pruned by `pruneInvalidTokens`; reinstall to get a fresh one |
| Notifications work but tapping doesn't navigate | `data.deepLink` missing on the dispatch call | Inspect `notification.service.dispatch` callers — every push that should route must set `deepLink` |

---

## How it's wired (reference)

### Server

```
notification.service.dispatch(args)
  ├─ persists Notification doc
  └─ _fanOut() ────► fcm.service.sendToTokens(tokens, payload)
                       │
                       ├─ batches at 500 per multicast call
                       ├─ stamps Notification.pushDelivery.{succeeded,failed,lastError}
                       └─ prunes invalid tokens via Device.updateMany
```

- **Per-user push** → query `Device.find({ user, isActive, fcmToken })`.
- **Broadcast (`user: null`)** → query `Device.find({ isActive, fcmToken })`
  with `user` projection so invalid-token cleanup can scope back to
  each owning user.

Scale note: the broadcast fan-out is a single `Device.find()` and a
chunked multicast call. Fine up to ~50k tokens. Beyond that, page the
device query and dispatch from a dedicated cron route with retry/backoff.

### Mobile

```
main.dart           ─► PushService.init()
auth_controller     ─► PushService.registerCurrentDevice()  (after sign-in)
FirebaseMessaging
  .onBackgroundMessage ─► firebaseMessagingBackgroundHandler (top-level fn)
  .onMessage           ─► PushService._showForegroundBanner (snackbar)
  .onMessageOpenedApp  ─► PushService._emitTap → tapStream
  .getInitialMessage   ─► PushService._emitTap → tapStream  (cold-start)

router.dart subscribes to PushService.tapStream and navigates by
data.deepLink whenever the user taps a notification.
```
