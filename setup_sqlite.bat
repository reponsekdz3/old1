@echo off
echo ========================================
echo SQLite Setup for VipChat
echo ========================================

:: Create sqlite directory
set SQLITE_DIR=%USERPROFILE%\.vipchat\sqlite
if not exist "%SQLITE_DIR%" mkdir "%SQLITE_DIR%"

:: Check if sqlite3.exe already exists
if exist "%SQLITE_DIR%\sqlite3.exe" (
    echo SQLite already installed at %SQLITE_DIR%
    goto :addpath
)

echo.
echo Downloading SQLite...
echo Please download sqlite-tools-win-x64-*.zip from:
echo https://www.sqlite.org/download.html
echo.
echo Extract sqlite3.exe to: %SQLITE_DIR%
echo Then run this script again.
echo.
pause
exit /b 1

:addpath
echo.
echo Adding SQLite to PATH...

:: Add to user PATH permanently
setx PATH "%PATH%;%SQLITE_DIR%"

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo SQLite installed at: %SQLITE_DIR%
echo Database location: %cd%\backend\instance\vipchat.db
echo.
echo To use SQLite, open a NEW command prompt and type:
echo   sqlite3 backend\instance\vipchat.db
echo.
echo Press any key to test SQLite...
pause >nul

:: Test SQLite
"%SQLITE_DIR%\sqlite3.exe" --version
if %ERRORLEVEL% EQU 0 (
    echo.
    echo SUCCESS! SQLite is working.
) else (
    echo.
    echo ERROR: SQLite test failed.
)

echo.
pause
