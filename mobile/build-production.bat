@echo off
echo ========================================
echo   VipChat Mobile - Production Builder
echo ========================================
echo.

cd /d "%~dp0"

echo [1/5] Checking prerequisites...
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: npm is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

where eas >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo EAS CLI not found. Installing...
    call npm install -g eas-cli
    if %ERRORLEVEL% NEQ 0 (
        echo ERROR: Failed to install EAS CLI
        pause
        exit /b 1
    )
)

echo [2/5] Installing dependencies...
if not exist "node_modules" (
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo ERROR: Failed to install dependencies
        pause
        exit /b 1
    )
) else (
    echo Dependencies already installed. Skipping...
)

echo.
echo [3/5] Select build platform:
echo   1 - Android APK only
echo   2 - iOS IPA only
echo   3 - Both Android and iOS
echo   4 - Android AAB (Google Play Store)
echo   5 - Preview Build (Testing)
echo.
set /p choice="Enter your choice (1-5): "

echo.
echo [4/5] Starting build process...

if "%choice%"=="1" (
    echo Building Android APK...
    call eas build --platform android --profile production
) else if "%choice%"=="2" (
    echo Building iOS IPA...
    call eas build --platform ios --profile production
) else if "%choice%"=="3" (
    echo Building both Android and iOS...
    call eas build --platform all --profile production
) else if "%choice%"=="4" (
    echo Building Android AAB for Play Store...
    call eas build --platform android --profile production-aab
) else if "%choice%"=="5" (
    echo Building preview version...
    call eas build --platform all --profile preview
) else (
    echo Invalid choice. Exiting...
    pause
    exit /b 1
)

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Build failed. Check the logs above.
    echo.
    echo Common solutions:
    echo   - Run: eas login
    echo   - Run: eas build:configure
    echo   - Check your internet connection
    echo   - Verify Apple/Google credentials
    pause
    exit /b 1
)

echo.
echo [5/5] Build completed successfully!
echo.
echo Next steps:
echo   1. Go to https://expo.dev
echo   2. Navigate to your project builds
echo   3. Download the APK/IPA file
echo   4. Install on your device
echo.
echo For Android: Enable "Install from Unknown Sources"
echo For iOS: Use TestFlight or direct installation
echo.

set /p download="Download build now? (y/n): "
if /i "%download%"=="y" (
    echo Opening EAS dashboard...
    start https://expo.dev
)

echo.
echo Build process complete!
pause
