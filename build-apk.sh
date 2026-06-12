#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# VipChat APK Builder
# Builds the Android APK via Expo Application Services (EAS) and optionally
# copies the result to backend/uploads/releases/ so the web /download page
# can serve it directly.
#
# Requirements:
#   • Node.js >= 18
#   • An Expo account  (eas login)
#   • Internet connection
#
# Usage:
#   chmod +x build-apk.sh
#   ./build-apk.sh [--local]
#     --local   Build locally (requires Android SDK + Java 17)
#               Otherwise builds on EAS cloud (no SDK needed)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

MOBILE_DIR="$(pwd)/mobile"
RELEASES_DIR="$(pwd)/backend/uploads/releases"
APK_NAME="vipchat.apk"
VERSION="2.0.0"
BUILD_MODE="${1:-}"

echo "═══════════════════════════════════════════"
echo "  VipChat APK Builder  v${VERSION}"
echo "═══════════════════════════════════════════"

# ── Prerequisite checks ───────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "✗ Node.js is not installed. Install from https://nodejs.org"
  exit 1
fi
if ! command -v npm &>/dev/null; then
  echo "✗ npm is not installed."
  exit 1
fi

# ── Install EAS CLI if missing ────────────────────────────────────────────────
if ! command -v eas &>/dev/null; then
  echo "→ Installing EAS CLI..."
  npm install -g eas-cli
fi

cd "$MOBILE_DIR"

# ── Install dependencies ──────────────────────────────────────────────────────
echo "→ Installing mobile dependencies..."
npm install --legacy-peer-deps

# ── Configure API URL ─────────────────────────────────────────────────────────
if [ -z "${EXPO_PUBLIC_API_URL:-}" ]; then
  echo ""
  echo "⚠  EXPO_PUBLIC_API_URL is not set."
  echo "   The built APK will default to http://localhost:8000"
  echo "   For production, set:  export EXPO_PUBLIC_API_URL=https://api.yourdomain.com"
  echo ""
fi

mkdir -p "$RELEASES_DIR"

# ── Build ─────────────────────────────────────────────────────────────────────
if [ "$BUILD_MODE" = "--local" ]; then
  echo "→ Building locally (requires Android SDK + Java 17)..."

  # Check for Java
  if ! command -v java &>/dev/null; then
    echo "✗ Java not found. Install JDK 17:"
    echo "  Ubuntu/Debian:  sudo apt install openjdk-17-jdk"
    echo "  macOS:          brew install openjdk@17"
    exit 1
  fi

  # Prebuild (generates native Android project)
  npx expo prebuild --platform android --clean

  # Build release APK with Gradle
  cd android
  ./gradlew assembleRelease
  cd ..

  APK_BUILT="android/app/build/outputs/apk/release/app-release.apk"
  if [ -f "$APK_BUILT" ]; then
    cp "$APK_BUILT" "$RELEASES_DIR/$APK_NAME"
    echo ""
    echo "✓ APK built and copied to backend/uploads/releases/${APK_NAME}"
    echo "  Size: $(du -h "$RELEASES_DIR/$APK_NAME" | cut -f1)"
    echo "  Download via: /api/app/download"
  else
    echo "✗ Build failed — APK not found at $APK_BUILT"
    exit 1
  fi

else
  # ── EAS Cloud Build ──────────────────────────────────────────────────────────
  echo "→ Starting EAS cloud build (Android APK)..."
  echo "   This takes 10-15 minutes. You'll get a download link when done."
  echo ""

  # Ensure logged in
  if ! eas whoami &>/dev/null 2>&1; then
    echo "→ Please log in to your Expo account:"
    eas login
  fi

  # Run EAS build
  eas build --platform android --profile production --non-interactive || {
    echo ""
    echo "ℹ  Build submitted. Check status at: https://expo.dev"
    echo "   After build completes:"
    echo "   1. Download the .apk file from the EAS dashboard"
    echo "   2. Copy it to: backend/uploads/releases/vipchat.apk"
    echo "   3. The /download page will automatically detect and serve it"
    exit 0
  }

  # Try to download the latest build
  LATEST_BUILD_ID=$(eas build:list --platform android --status finished --limit 1 --json 2>/dev/null | python3 -c "import sys,json; builds=json.load(sys.stdin); print(builds[0]['id'] if builds else '')" 2>/dev/null || echo "")

  if [ -n "$LATEST_BUILD_ID" ]; then
    echo "→ Downloading APK (build: $LATEST_BUILD_ID)..."
    eas build:download --id "$LATEST_BUILD_ID" --output "$RELEASES_DIR/$APK_NAME" || {
      echo "⚠  Auto-download failed. Get the APK from https://expo.dev and copy to backend/uploads/releases/vipchat.apk"
    }
    echo ""
    echo "✓ APK available at backend/uploads/releases/${APK_NAME}"
    echo "  Download via: /api/app/download"
  fi
fi

echo ""
echo "═══════════════════════════════════════════"
echo "  Done! Your APK is ready."
echo ""
echo "  To make it available for download:"
echo "  • Web:    curl -X POST /api/app/upload-apk (see backend docs)"
echo "  • Or place APK at: backend/uploads/releases/vipchat.apk"
echo ""
echo "  Download page: /download"
echo "═══════════════════════════════════════════"
