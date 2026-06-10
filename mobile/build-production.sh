#!/bin/bash

echo "========================================"
echo "  VipChat Mobile - Production Builder"
echo "========================================"
echo ""

cd "$(dirname "$0")"

echo "[1/5] Checking prerequisites..."
if ! command -v npm &> /dev/null; then
    echo "ERROR: npm is not installed"
    echo "Please install Node.js from https://nodejs.org"
    exit 1
fi

if ! command -v eas &> /dev/null; then
    echo "EAS CLI not found. Installing..."
    npm install -g eas-cli
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to install EAS CLI"
        exit 1
    fi
fi

echo "[2/5] Installing dependencies..."
if [ ! -d "node_modules" ]; then
    npm install
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to install dependencies"
        exit 1
    fi
else
    echo "Dependencies already installed. Skipping..."
fi

echo ""
echo "[3/5] Select build platform:"
echo "  1 - Android APK only"
echo "  2 - iOS IPA only"
echo "  3 - Both Android and iOS"
echo "  4 - Android AAB (Google Play Store)"
echo "  5 - Preview Build (Testing)"
echo ""
read -p "Enter your choice (1-5): " choice

echo ""
echo "[4/5] Starting build process..."

case $choice in
    1)
        echo "Building Android APK..."
        eas build --platform android --profile production
        ;;
    2)
        echo "Building iOS IPA..."
        eas build --platform ios --profile production
        ;;
    3)
        echo "Building both Android and iOS..."
        eas build --platform all --profile production
        ;;
    4)
        echo "Building Android AAB for Play Store..."
        eas build --platform android --profile production-aab
        ;;
    5)
        echo "Building preview version..."
        eas build --platform all --profile preview
        ;;
    *)
        echo "Invalid choice. Exiting..."
        exit 1
        ;;
esac

if [ $? -ne 0 ]; then
    echo ""
    echo "ERROR: Build failed. Check the logs above."
    echo ""
    echo "Common solutions:"
    echo "  - Run: eas login"
    echo "  - Run: eas build:configure"
    echo "  - Check your internet connection"
    echo "  - Verify Apple/Google credentials"
    exit 1
fi

echo ""
echo "[5/5] Build completed successfully!"
echo ""
echo "Next steps:"
echo "  1. Go to https://expo.dev"
echo "  2. Navigate to your project builds"
echo "  3. Download the APK/IPA file"
echo "  4. Install on your device"
echo ""
echo "For Android: Enable 'Install from Unknown Sources'"
echo "For iOS: Use TestFlight or direct installation"
echo ""

read -p "Download build now? (y/n): " download
if [ "$download" = "y" ] || [ "$download" = "Y" ]; then
    echo "Opening EAS dashboard..."
    if command -v xdg-open &> /dev/null; then
        xdg-open https://expo.dev
    elif command -v open &> /dev/null; then
        open https://expo.dev
    else
        echo "Please open https://expo.dev in your browser"
    fi
fi

echo ""
echo "Build process complete!"
