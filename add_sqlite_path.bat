@echo off
echo ========================================
echo Adding SQLite to PATH
echo ========================================

:: Add C:\sqlite to user PATH permanently
setx PATH "%PATH%;C:\sqlite"

echo.
echo SQLite path added successfully!
echo.
echo Please open a NEW command prompt to use sqlite commands.
echo.
echo To access your database, use:
echo   sqlite C:\Users\hp\Downloads\bitese1\bitese1\backend\instance\vipchat.db
echo.
pause
