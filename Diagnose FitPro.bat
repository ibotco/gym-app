@echo off
title FitPro diagnostics
cd /d "%~dp0"
set "OUT=%~dp0fitpro-diagnose.txt"

echo Writing %OUT%
echo FitPro diagnostics > "%OUT%"
echo Time: %date% %time% >> "%OUT%"
echo Folder: %cd% >> "%OUT%"
echo. >> "%OUT%"

echo === node === >> "%OUT%"
where node >> "%OUT%" 2>&1
node -v >> "%OUT%" 2>&1
echo. >> "%OUT%"

echo === npm === >> "%OUT%"
where npm >> "%OUT%" 2>&1
call npm -v >> "%OUT%" 2>&1
echo. >> "%OUT%"

echo === files === >> "%OUT%"
if exist package.json (echo package.json YES >> "%OUT%") else (echo package.json NO >> "%OUT%")
if exist node_modules (echo node_modules YES >> "%OUT%") else (echo node_modules NO >> "%OUT%")
if exist src\main.tsx (echo src\main.tsx YES >> "%OUT%") else (echo src\main.tsx NO >> "%OUT%")
echo. >> "%OUT%"

echo === port 5173 === >> "%OUT%"
netstat -ano | findstr /R /C:":5173" >> "%OUT%"
if errorlevel 1 echo nothing listening on 5173 >> "%OUT%"

echo.
echo Done. Opening the report...
notepad "%OUT%"
pause
