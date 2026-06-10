# VipChat Mobile - Production Build Guide

## 🚀 Build Production APK & iOS App

### Prerequisites

1. **Install EAS CLI**
```bash
npm install -g eas-cli
```

2. **Login to Expo**
```bash
eas login
```

3. **Configure Project**
```bash
cd mobile
eas build:configure
```

---

## 📱 Build Android APK (Production)

### Option 1: APK for Direct Distribution
```bash
npm run build:android
# or
eas build --platform android --profile production
```

This creates an **APK file** that can be:
- Downloaded directly from EAS dashboard
- Distributed via USB, file sharing, or web download
- Installed on any Android device (with "Install from Unknown Sources" enabled)

### Option 2: AAB for Google Play Store
```bash
npm run build:android-aab
# or
eas build --platform android --profile production-aab
```

This creates an **Android App Bundle (AAB)** for Google Play Store submission.

---

## 🍎 Build iOS App (Production)

```bash
npm run build:ios
# or
eas build --platform ios --profile production
```

**Requirements:**
- Apple Developer Account ($99/year)
- Provisioning Profile & Certificates (EAS handles automatically)

---

## 🔄 Build Both Platforms Simultaneously

```bash
npm run build:all
# or
eas build --platform all --profile production
```

---

## 📥 Download Built Apps

After build completes:

1. **Via EAS Dashboard:**
   - Go to https://expo.dev
   - Navigate to your project → Builds
   - Download APK or IPA

2. **Via CLI:**
```bash
eas build:list
eas build:download [build-id]
```

---

## 🏪 Submit to App Stores

### Google Play Store
```bash
npm run submit:android
# or
eas submit --platform android
```

**Required:**
- `google-play-service-account.json` (Google Play Console)
- First upload must be manual via Play Console

### Apple App Store
```bash
npm run submit:ios
# or
eas submit --platform ios
```

**Required:**
- Apple ID
- App-specific password
- App Store Connect API Key

---

## 🧪 Preview Builds (Internal Testing)

```bash
npm run build:preview
# or
eas build --profile preview
```

Creates internal test builds for QA without affecting production.

---

## 📦 Local Build (Without EAS)

### Android (Requires Android Studio)
```bash
npx expo prebuild --platform android
cd android
./gradlew assembleRelease
# APK location: android/app/build/outputs/apk/release/app-release.apk
```

### iOS (Requires Xcode on macOS)
```bash
npx expo prebuild --platform ios
cd ios
xcodebuild -workspace VipChat.xcworkspace -scheme VipChat -configuration Release
```

---

## 🔐 Code Signing

### Android
1. **Generate Keystore:**
```bash
keytool -genkeypair -v -storetype PKCS12 -keystore vipchat-release.keystore -alias vipchat -keyalg RSA -keysize 2048 -validity 10000
```

2. **Configure in eas.json:**
```json
{
  "build": {
    "production": {
      "android": {
        "credentialsSource": "local"
      }
    }
  }
}
```

3. **Provide credentials during build**

### iOS
EAS handles signing automatically. For manual signing:
- Create App ID in Apple Developer Portal
- Generate Distribution Certificate
- Create Provisioning Profile

---

## 🌐 Environment Configuration

Create `mobile/.env.production`:

```env
API_URL=https://api.vipchat.app
SOCKET_URL=https://socket.vipchat.app
STRIPE_PUBLISHABLE_KEY=pk_live_...
```

---

## ✅ Pre-Build Checklist

- [ ] Update `version` in `app.json` (e.g., "2.0.1")
- [ ] Increment `versionCode` (Android) and `buildNumber` (iOS)
- [ ] Set production API URLs in environment
- [ ] Test all features on physical devices
- [ ] Remove console.log statements (optional)
- [ ] Update app icons and splash screens
- [ ] Review permissions in `app.json`
- [ ] Test offline functionality
- [ ] Verify E2EE encryption works
- [ ] Test push notifications
- [ ] Verify in-app purchases (if applicable)

---

## 🐛 Common Issues & Solutions

### Issue: "Build failed - Missing credentials"
**Solution:** Run `eas credentials` to configure signing

### Issue: "Android build stuck at 'Building...'"
**Solution:** Check build logs: `eas build:view [build-id]`

### Issue: "iOS build requires paid Apple account"
**Solution:** Enroll in Apple Developer Program ($99/year)

### Issue: "APK installs but crashes immediately"
**Solution:** Check native dependencies, run `npx expo-doctor`

---

## 📊 Build Profiles Explained

| Profile | Purpose | Output | Use Case |
|---------|---------|--------|----------|
| `production` | Release build | APK/IPA | App store distribution |
| `production-aab` | Play Store build | AAB | Google Play Store only |
| `preview` | Internal testing | APK/IPA | QA, beta testing |
| `development` | Dev build | DEV client | Active development |

---

## 🚀 Quick Production Build

**For immediate APK download:**

```bash
cd mobile
eas build --platform android --profile production
```

Wait 10-15 minutes → Download APK from EAS dashboard → Install on Android device

**For iOS:**
```bash
eas build --platform ios --profile production
```

Wait 15-20 minutes → Download IPA → Install via TestFlight or direct installation

---

## 📱 Install APK on Android Device

### Method 1: Direct Download
1. Enable "Install from Unknown Sources" on Android device
2. Download APK from EAS dashboard to device
3. Open APK file and tap "Install"

### Method 2: ADB Install
```bash
adb install path/to/vipchat.apk
```

### Method 3: Share via USB
1. Connect device to computer
2. Copy APK to device storage
3. Use file manager on device to install

---

## 🎉 Success!

After successful build, you'll have:
- ✅ **Android:** `vipchat-2.0.0.apk` (50-80 MB)
- ✅ **iOS:** `vipchat-2.0.0.ipa` (60-100 MB)

Both ready for production deployment!

---

## 📞 Support

- Build logs: `eas build:list`
- View specific build: `eas build:view [build-id]`
- Cancel build: `eas build:cancel [build-id]`
- EAS Documentation: https://docs.expo.dev/build/introduction/

---

## 🔄 Continuous Updates (OTA)

After initial install, push updates without rebuilding:

```bash
npm run update
# or
eas update --branch production --message "Bug fixes"
```

Users get updates automatically on next app launch!

---

**Build Time Estimates:**
- Android APK: 10-15 minutes
- iOS IPA: 15-20 minutes
- Both platforms: 20-25 minutes (parallel)

**Build Frequency:** Unlimited builds on Expo free tier (with queue wait times)

---

Made with ❤️ by VipChat Team
