@echo off
REM Mobile Garage – start inventory server + print service (after INSTALL.md setup).
REM Requires: npm install at repo root, server\.env, print-service\.env

setlocal

cd /d "%~dp0"

echo Starting Mobile Garage services...
echo - Inventory server (web + API)
echo - Print service
echo.

call npm run start

endlocal
