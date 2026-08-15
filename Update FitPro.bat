@echo off
title Update FitPro
cd /d "%~dp0"

echo.
echo ========================================
echo   FitPro — apply an update pack
echo ========================================
echo.
echo 1. Stop the running app first.
echo 2. Unzip the new fitpro.update.zip OVER this folder.
echo    Replace files when Windows asks.
echo 3. Then run this script.
echo.

echo Stopping anything on port 5173...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:":5173 .*LISTENING"') do (
  taskkill /PID %%p /F >nul 2>nul
)

if not exist "package.json" (
  echo [ERROR] Run this inside your fitpro folder.
  pause
  exit /b 1
)

echo Installing / updating packages...
call npm install
if errorlevel 1 (
  echo [ERROR] npm install failed.
  pause
  exit /b 1
)

echo.
echo Update installed. Starting FitPro...
echo Keep the next window open while you use the app.
echo.
call "%~dp0Start FitPro.bat"
