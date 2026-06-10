# VipChat Mobile - Production Deployment Guide

## 🚀 Quick Build Commands

### Windows
```cmd
cd mobile
build-production.bat
```

### Mac/Linux
```bash
cd mobile
chmod +x build-production.sh
./build-production.sh
```

---

## 📋 Pre-Build Checklist

### 1. Install Prerequisites
```bash
# Install EAS CLI globally
npm install -g eas-cli

# Login to Expo account
eas login

# Verify installation
eas --version
```

### 2. Update Version Numbers

**app.json**:
```json
{
  "expo": {
    "version": "2.0.0",
    "ios": {
      "buildNumber": "1"
    },
    "android": {
      "versionCode": 1
    }
  }
}
```

**package.json**:
```json
{
  "version": "2.0.0"
}
```

### 3. Configure Environment

**Production Backend URL** (`.env.production`):
```env
EXPO_PUBLIC_API_URL=https://api.vipchat.app
```

---

## 🏗️ First-Time Setup

### Step 1: Initialize EAS Project
```bash
cd mobile
eas init
```

This creates an EAS project ID. Update `app.json`:
```json
{
  "extra": {
    "eas": {
      "projectId": "YOUR_EAS_PROJECT_ID_HERE"
    }
  },
  "updates": {
    "url": "https://u.expo.dev/YOUR_EAS_PROJECT_ID_HERE"
  }
}
```

### Step 2: Configure Credentials

#### iOS Credentials
```bash
eas credentials
```

You need:
- **Apple Developer Account** ($99/year)
- **Distribution Certificate**
- **Provisioning Profile**
- **Push Notification Key** (for APNs)

Let EAS manage credentials automatically (recommended).

#### Android Credentials
```bash
eas credentials -p android
```

EAS will auto-generate:
- **Keystore** (for signing APK/AAB)
- **Upload Key** (for Play Store)

---

## 📱 Build Production Apps

### Android APK (Direct Install)
```bash
npm run build:android
# or
eas build --platform android --profile production
```

**Build time:** 10-15 minutes

**Output:** APK file (downloadable from EAS dashboard)

**Distribution:** Direct download link or upload to your website

### Android AAB (Google Play Store)
```bash
npm run build:android-aab
# or
eas build --platform android --profile production-aab
```

**Build time:** 10-15 minutes

**Output:** AAB file (Android App Bundle)

**Distribution:** Upload to Google Play Console

### iOS IPA (App Store)
```bash
npm run build:ios
# or
eas build --platform ios --profile production
```

**Build time:** 15-25 minutes

**Output:** IPA file (iOS App Archive)

**Distribution:** Submit to App Store Connect

### Build Both Platforms
```bash
npm run build:all
# or
eas build --platform all --profile production
```

---

## 📲 Download Built Apps

### Option 1: EAS Dashboard
1. Visit https://expo.dev/accounts/YOUR_ACCOUNT/projects/vipchat/builds
2. Find your build
3. Click "Download" button
4. Get APK/IPA file

### Option 2: CLI
```bash
# List recent builds
eas build:list

# Download specific build
eas build:download --id BUILD_ID
```

---

## 🏪 Store Submission

### Google Play Store (Android)

#### 1. Create Play Console Account
- Visit https://play.google.com/console
- Pay $25 one-time registration fee
- Complete account setup

#### 2. Create App Listing
```bash
# In Play Console
1. Click "Create App"
2. App name: VipChat
3. Default language: English
4. App type: Application
5. Category: Communication
6. Complete store listing (screenshots, descriptions)
```

#### 3. Upload AAB
```bash
# Build AAB
npm run build:android-aab

# Download from EAS dashboard
# Upload to Play Console → Production → Create new release
```

#### 4. Submit for Review
- Fill content rating questionnaire
- Set pricing (Free)
- Select countries
- Submit for review (approval: few hours to 3 days)

### Apple App Store (iOS)

#### 1. Apple Developer Account
- Visit https://developer.apple.com
- Enroll ($99/year)
- Complete account setup

#### 2. App Store Connect Setup
```bash
# Visit https://appstoreconnect.apple.com
1. Click "My Apps" → "+"
2. Select "New App"
3. Platform: iOS
4. Name: VipChat
5. Bundle ID: com.vipchat.app (must match app.json)
6. SKU: VIPCHAT001
7. Full Access
```

#### 3. Upload IPA
```bash
# Build IPA
npm run build:ios

# Download from EAS
# Use Transporter app or:
eas submit --platform ios
```

#### 4. Complete App Information
- Screenshots (6.5" and 5.5" iPhone)
- App description
- Keywords
- Support URL
- Privacy policy URL
- Categories
- Age rating

#### 5. Submit for Review
- Complete App Review Information
- Export compliance: No encryption (or complete ITR)
- Submit for review (approval: 1-3 days typically)

---

## 🔄 Over-The-Air (OTA) Updates

Update JavaScript/assets without rebuilding:

```bash
# Update production
eas update --branch production --message "Bug fixes and improvements"

# Update specific channel
eas update --channel production --message "Feature: Dark mode"
```

**What can be updated:**
- ✅ JavaScript code
- ✅ React components
- ✅ Assets (images, fonts)
- ✅ Configuration

**What requires rebuild:**
- ❌ Native code changes
- ❌ New permissions
- ❌ Expo SDK upgrade
- ❌ Native module updates

---

## 🔐 Push Notifications Setup

### Firebase Cloud Messaging (FCM)

#### 1. Create Firebase Project
```bash
1. Visit https://console.firebase.google.com
2. Click "Add project"
3. Project name: VipChat
4. Enable Google Analytics (optional)
5. Create project
```

#### 2. Add Android App
```bash
1. Click Android icon
2. Package name: com.vipchat.app
3. Download google-services.json
4. Place in mobile/ directory
```

#### 3. Add iOS App
```bash
1. Click iOS icon
2. Bundle ID: com.vipchat.app
3. Download GoogleService-Info.plist
4. Place in mobile/ directory
```

#### 4. Get FCM Server Key
```bash
1. Project Settings → Cloud Messaging
2. Copy "Server key"
3. Add to backend .env:
   FCM_SERVER_KEY=your_server_key
```

#### 5. Update app.json
```json
{
  "android": {
    "googleServicesFile": "./google-services.json"
  },
  "ios": {
    "googleServicesFile": "./GoogleService-Info.plist"
  }
}
```

### Apple Push Notification Service (APNs)

```bash
1. Apple Developer → Certificates, Identifiers & Profiles
2. Keys → + (Create new key)
3. Name: VipChat Push Notifications
4. Enable: Apple Push Notifications service (APNs)
5. Download .p8 key file
6. Note: Key ID and Team ID
7. Upload to Expo: eas credentials
```

---

## 🧪 Testing Builds

### Internal Testing (Before Store Submission)

#### Android - Internal Testing Track
```bash
1. Play Console → Internal testing
2. Create email list of testers
3. Upload AAB
4. Share testing link with team
```

#### iOS - TestFlight
```bash
1. Submit build to App Store Connect
2. TestFlight → Internal Testing
3. Add testers (up to 100)
4. Automatic invite sent via email
```

### Test Checklist
- [ ] Login/logout
- [ ] Send text messages
- [ ] Send photos/videos
- [ ] Voice/video calls
- [ ] Push notifications
- [ ] Contact sync
- [ ] Offline mode
- [ ] Marketplace browsing
- [ ] Payment flow
- [ ] Background app state
- [ ] App crashes/errors
- [ ] Performance on low-end devices
- [ ] Different Android versions (8.0+)
- [ ] Different iOS versions (13.0+)

---

## 🔧 Troubleshooting

### Build Errors

#### "No valid distribution certificate found"
```bash
eas credentials
# Let EAS generate new credentials
```

#### "Bundle identifier already exists"
```bash
# Change bundle ID in app.json:
"ios": {
  "bundleIdentifier": "com.yourcompany.vipchat"
}
```

#### "Gradle build failed"
```bash
# Check Android build logs
# Common fixes:
- Increase heap size
- Update build.gradle
- Clear Gradle cache
```

#### "Build timeout"
```bash
# Use local builds (faster):
npm install -g eas-cli
eas build --local
```

### Store Rejection Issues

#### iOS Rejection - Crash on Launch
```bash
# Test on physical device first
# Check crash logs in App Store Connect
# Ensure all Info.plist permissions are accurate
```

#### Android Rejection - Security Issues
```bash
# Run security audit:
npm audit fix

# Remove unnecessary permissions from app.json
```

#### Privacy Policy Required
```bash
# Create privacy policy page
# Add URL to store listing
# Include:
  - Data collection practices
  - Third-party services
  - User rights
  - Contact information
```

---

## 📊 Post-Launch Monitoring

### Crash Reporting

Install Sentry (optional):
```bash
npm install @sentry/react-native
npx @sentry/wizard -i reactNative -p ios android

# Add to app/_layout.js:
import * as Sentry from "@sentry/react-native";

Sentry.init({
  dsn: "YOUR_SENTRY_DSN",
  environment: __DEV__ ? "development" : "production",
});
```

### Analytics

Google Analytics (Firebase):
```bash
npm install @react-native-firebase/app @react-native-firebase/analytics

# Track events:
import analytics from '@react-native-firebase/analytics';

await analytics().logEvent('message_sent', {
  type: 'text',
  encrypted: true,
});
```

---

## 🚀 Continuous Deployment

### GitHub Actions (Auto-Build on Push)

Create `.github/workflows/build.yml`:
```yaml
name: EAS Build
on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install -g eas-cli
      - run: cd mobile && npm install
      - run: eas build --platform all --non-interactive --no-wait
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
```

Get EXPO_TOKEN:
```bash
eas login
eas build:configure
# Add token to GitHub Secrets
```

---

## 📝 Version Management

### Increment Version
```bash
# app.json
{
  "version": "2.1.0",  # Major.Minor.Patch
  "ios": {
    "buildNumber": "2"  # Increment each build
  },
  "android": {
    "versionCode": 2    # Must increment each release
  }
}
```

### Version Strategy
- **Patch (2.0.1)**: Bug fixes
- **Minor (2.1.0)**: New features (backward compatible)
- **Major (3.0.0)**: Breaking changes

---

## 🌍 Multi-Language Support

Add translations:
```bash
# Create i18n/ directory
mobile/
  i18n/
    en.json
    es.json
    fr.json
    ar.json
```

Install i18n:
```bash
npm install i18next react-i18next
```

---

## ✅ Production Ready Checklist

Before submitting to stores:

### Technical
- [ ] Build succeeds without errors
- [ ] All features tested on real devices
- [ ] Crash-free for 48 hours in beta
- [ ] Performance tested on low-end devices
- [ ] Battery usage optimized
- [ ] Network handling (offline/slow connection)
- [ ] Memory leaks checked
- [ ] Deep links work correctly

### Legal & Compliance
- [ ] Privacy policy published
- [ ] Terms of service published
- [ ] GDPR compliance (EU)
- [ ] COPPA compliance (if under 13)
- [ ] Export compliance declaration
- [ ] Copyright notices

### Store Assets
- [ ] App icon (1024x1024)
- [ ] Screenshots (all required sizes)
- [ ] Feature graphic (Android)
- [ ] App description
- [ ] Keywords optimized
- [ ] Support URL
- [ ] Marketing URL
- [ ] Age rating completed

### Backend Ready
- [ ] Production API deployed
- [ ] Database backed up
- [ ] CDN configured for media
- [ ] Push notification server running
- [ ] Monitoring/alerts set up
- [ ] Rate limiting enabled
- [ ] HTTPS/SSL configured

---

## 📞 Support

### Expo Documentation
- Build: https://docs.expo.dev/build/introduction/
- Submit: https://docs.expo.dev/submit/introduction/
- Updates: https://docs.expo.dev/eas-update/introduction/

### Store Documentation
- Play Console: https://support.google.com/googleplay/android-developer
- App Store Connect: https://developer.apple.com/app-store-connect/

### VipChat Support
- Email: support@vipchat.app
- Documentation: https://docs.vipchat.app

---

**Built with ❤️ for production deployment**
