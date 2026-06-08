# DET — Play Store launch checklist (v1.0.0)

Step-by-step for the first internal-testing submission. Skip steps
you've already done.

Sister docs:
- [`PLAYSTORE_LISTING.md`](./PLAYSTORE_LISTING.md) — copy/paste listing copy
- [`legal/privacy-policy.md`](./legal/privacy-policy.md) — privacy policy (served at /privacy)
- [`legal/terms-of-service.md`](./legal/terms-of-service.md) — terms (served at /terms)
- [`../mobile-app/RELEASE.md`](../mobile-app/RELEASE.md) — Play + App Store release flow

---

## Phase A — Pre-flight (do once)

### A1. Create the Play Console account

- Go to <https://play.google.com/console>.
- Pay the one-time **$25** developer registration fee.
- Verify your identity (Play now requires this for new individual
  developer accounts).
- Decide: individual or organisation account? You can't change it
  later without creating a new account.

### A2. Create the app shell in Play Console

1. **All apps → Create app.**
2. App name: `DET` (or `DET — Expense Tracker` if "DET" is taken).
3. Default language: English (United States).
4. App or game: **App**.
5. Free or paid: **Free** (in-app purchases are configured separately).
6. Tick both declarations (Developer Program Policies, US export laws).

### A3. Configure your in-app products *(skip if you're shipping
free-tier-only for v1.0.0)*

Play Console → Monetisation setup → Subscriptions:

- `premium_monthly` — Premium · ₹199 / month
- `premium_yearly` — Premium · ₹1,499 / year

Both must match the SKUs in `lib/services/subscription.service.js`.

---

## Phase B — App signing

Play recommends **Play App Signing** (Google holds the upload key, you
hold an *upload key* — losing it just means rotating, not losing the
app).

### B1. Generate the upload keystore (one time, never check this in)

```powershell
cd C:\DET\mobile-app\android
keytool -genkey -v -keystore upload-keystore.jks -keyalg RSA `
        -keysize 2048 -validity 10000 -alias upload
```

Answer the prompts. Use a strong password and **back the .jks file
up somewhere outside this repo** (cloud drive, password manager,
encrypted USB — anywhere except this directory).

### B2. Wire the signing config

Create `mobile-app/android/key.properties` (NOT in version control;
already in `.gitignore` via the standard Flutter template):

```properties
storePassword=<your store password>
keyPassword=<your key password>
keyAlias=upload
storeFile=C:/full/path/to/upload-keystore.jks
```

Update `mobile-app/android/app/build.gradle.kts`:

```kotlin
import java.util.Properties
import java.io.FileInputStream

// Load key.properties if present so debug builds keep working without it.
val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

android {
    // ... existing config ...

    signingConfigs {
        create("release") {
            keyAlias = keystoreProperties["keyAlias"] as String?
            keyPassword = keystoreProperties["keyPassword"] as String?
            storeFile = (keystoreProperties["storeFile"] as String?)?.let { file(it) }
            storePassword = keystoreProperties["storePassword"] as String?
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }
}
```

### B3. Verify a release build works

```powershell
cd C:\DET\mobile-app
flutter build appbundle --release `
  --dart-define=GOOGLE_SIGN_IN_SERVER_CLIENT_ID=<your-web-client-id> `
  --dart-define=LEGAL_BASE_URL=https://det.app `
  --dart-define=SUPPORT_EMAIL=support@det.app
```

Output: `mobile-app/build/app/outputs/bundle/release/app-release.aab`.
Roughly 25–40 MB.

### B4. Enrol in Play App Signing

When you upload your first `.aab` to Play Console, it will offer to
enrol you in Play App Signing. **Say yes.** Google will generate the
distribution key; your upload key stays in your hands.

---

## Phase C — Assets

Play Console enforces exact sizes. Use the master PNGs in
`mobile-app/assets/branding/` as the source; export at the sizes below.

### C1. App icon (already generated)

| Asset | Size | Path | Source |
| --- | --- | --- | --- |
| Play Store icon | 512×512 PNG, alpha | upload separately | scale `app_icon.png` |
| Launcher icon | 1024×1024 master | `mobile-app/assets/branding/app_icon.png` | regen via `dart run tool/build_brand_assets.dart` |
| Adaptive foreground | 1024×1024, transparent | `mobile-app/assets/branding/app_icon_foreground.png` | regen via the same tool |

### C2. Feature graphic

- **1024 × 500 PNG or JPG.**
- Shows at the top of the listing on phones in the Play app.
- Recommendation: brand-blue gradient (#5B7CFA → #4564D6) background +
  white "DET" wordmark + a one-line tagline ("Money clarity, every
  day.") on the right.

### C3. Screenshots

Required: **at least 2** phone screenshots, max 8. Sizes Play accepts
for phone screenshots: 320–3,840 px on each side, 16:9 / 9:16, JPG or
PNG.

Suggested shots (take with the device frame on, dark and light mixed):

1. **Home / Dashboard** — donut chart visible, brand-blue hero, accounts strip.
2. **Add expense sheet** — bottom sheet open, category strip + amount field visible.
3. **Analytics** — monthly trend chart, top categories.
4. **Calendar** — month grid with intensity heatmap + inline day detail.
5. **Shared accounts** — members screen with one pending invitation.
6. **Bills** — upcoming bills with badges (Due today, Overdue, etc).
7. **Settings** — theme segmented control highlighted.
8. **Profile** — clean account header.

Tip: use `flutter screenshot` while running on a phone in
demo-mode, or use Android Studio's recorder.

### C4. (Optional) Tablet screenshots — only if you want a "Designed
for tablet" badge. Skip for v1.0.

---

## Phase D — Data Safety questionnaire

Play Console → App content → **Data safety**. Answer based on
`docs/legal/privacy-policy.md`. Cheat-sheet:

| Question | Answer |
| --- | --- |
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** |
| Do you provide a way for users to request that their data is deleted? | **Yes** (in-app delete account or by email) |
| Personal info — Name | Collected · For app functionality |
| Personal info — Email address | Collected · For account management, communications |
| Financial info — User payment info | Collected only if subscribing (via Play Billing) |
| Financial info — Other financial info | **NOT collected** by us in the sense of "shared with us" — *user-generated content stored on our servers* |
| App activity — App interactions | Collected · For analytics (aggregated) |
| Device or other IDs | Collected (push token) · For functionality (notifications) |
| Diagnostics — Crash logs | Collected · For app functionality |

Click through the rest selecting *No* unless your integration list
changes.

---

## Phase E — Content rating

Play Console → App content → **Content ratings**.

- Click **Start questionnaire**.
- Category: **Reference, News, or Educational** is the closest fit for
  a finance utility.
- Email: your `support@det.app`.
- Answer all violence / drugs / gambling questions **No**.
- The result will be **Everyone** (IARC) / **3+** (PEGI) / **All
  ages**.

---

## Phase F — Target audience + ads + COPPA

Play Console → App content → **Target audience and content**.

- **Target age group:** 18 and over (DET handles financial data —
  safer to gate to adults).
- **Appeals to children:** No.
- **Ads in your app:** **No**.
- COPPA: not applicable (18+).

---

## Phase G — Pricing & distribution

Play Console → Production → Pricing & distribution.

- Free.
- All countries available, unless you have a specific reason to
  exclude.
- Contains ads: No.

---

## Phase H — Submit to internal testing

This is the safe place to start — internal testing lets you and up to
100 testers install via a link, without any Play review beforehand.

1. Play Console → Testing → **Internal testing** → Create new release.
2. Upload `app-release.aab` from Phase B3.
3. Release name: `1.0.0 (1)`.
4. Release notes: paste from `docs/PLAYSTORE_LISTING.md` (the "What's
   new" block).
5. Save → Review release → **Start rollout to Internal testing**.
6. Email tab → add testers (yourself + collaborators). Share the opt-in
   link. Installs land within minutes.

---

## Phase I — Promote to closed → open → production

When internal testing is solid:

1. **Closed testing** (Alpha) — up to 200 testers per email list; this
   one *does* trigger a Play review (~1–3 days).
2. **Open testing** (Beta) — anyone can opt in via a link; still
   reviewed.
3. **Production** — full public launch. Reviews are stricter; budget
   3–7 days for the first review.

Each promotion step is one click in Play Console — you're not
re-uploading the AAB, just pushing the same release down the chain.

---

## Final pre-submission checklist

- [ ] `flutter build appbundle --release` succeeds without errors
- [ ] AAB is signed with the upload keystore (not debug)
- [ ] Privacy policy reachable at `https://det.app/privacy`
- [ ] Terms reachable at `https://det.app/terms`
- [ ] Support email `support@det.app` is monitored
- [ ] Crash a fresh install of the AAB on a real device — sign in,
      add an expense, change theme, sign out
- [ ] Verify the launcher icon is the new DET wordmark, not the old
      "D" mark
- [ ] Magic-link email opens DET on the phone (or document Google
      sign-in as the primary auth method)
- [ ] At least 2 screenshots ready
- [ ] Feature graphic (1024×500) ready
- [ ] Data Safety questionnaire submitted
- [ ] Content rating questionnaire submitted
