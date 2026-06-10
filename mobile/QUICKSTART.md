# 🚀 Quick Start - Build APK NOW

## For Windows Users

### Step 1: Open Command Prompt in mobile folder
```cmd
cd c:\Users\Q.C\Desktop\old1\mobile
```

### Step 2: Run the automated build script
```cmd
build-production.bat
```

**OR manually:**

```cmd
npm install -g eas-cli
eas login
npm install
eas build --platform android --profile production
```

---

## For Mac/Linux Users

### Step 1: Open Terminal in mobile folder
```bash
cd /path/to/old1/mobile
```

### Step 2: Make script executable and run
```bash
chmod +x build-production.sh
./build-production.sh
```

**OR manually:**

```bash
npm install -g eas-cli
eas login
npm install
eas build --platform android --profile production
```

---

## ⏱️ What Happens Next?

1. **Build starts** (10-15 minutes for Android, 15-20 for iOS)
2. **Progress shown** in terminal
3. **Build completes** - you'll get a link
4. **Download APK** from https://expo.dev

---

## 📥 Download & Install APK

1. Go to https://expo.dev
2. Click on your project → Builds
3. Find the latest build
4. Click "Download" to get the APK file
5. Transfer APK to your Android phone
6. Enable "Install from Unknown Sources" in Android settings
7. Open APK file on phone and tap "Install"

---

## ✅ Success! Your app is installed!

The APK includes ALL features:
- ✅ End-to-end encrypted messaging
- ✅ HD video & voice calls
- ✅ Contact sync
- ✅ Marketplace
- ✅ Groups & communities
- ✅ Business API
- ✅ Offline mode
- ✅ Push notifications
- ✅ QR login
- ✅ All production-ready features

---

## 🔥 Even Faster - One Command

```bash
cd mobile && eas build --platform android --profile production
```

That's it! Wait 15 minutes and download your production APK.

---

## 💡 Pro Tips

**Build both platforms at once:**
```bash
eas build --platform all --profile production
```

**Check build status:**
```bash
eas build:list
```

**Download completed build:**
```bash
eas build:download [build-id]
```

---

## 🆘 Troubleshooting

**Problem:** "eas: command not found"
```bash
npm install -g eas-cli
```

**Problem:** "Not logged in"
```bash
eas login
```

**Problem:** "Build failed"
```bash
eas build:view [build-id]
# Check the logs
```

---

## 📱 Test Before Building

Run dev version first to test:
```bash
cd mobile
npm install
npm start
# Scan QR code with Expo Go app
```

---

**Build Time:** 10-15 minutes
**APK Size:** ~50-80 MB
**Ready for:** Production distribution

GO BUILD! 🚀
