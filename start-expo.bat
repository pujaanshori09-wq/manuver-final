@echo off
echo ========================================
echo Starting Expo Development Server...
echo ========================================
echo.

cd /d "%~dp0"

REM Stop any running node processes
taskkill /F /IM node.exe 2>nul

REM Clear cache
if exist ".expo" rmdir /s /q ".expo"

REM Start Expo
echo Starting Expo in tunnel mode for iPhone...
echo.
node_modules\.bin\expo start --clear --tunnel

pause
