@echo off
setlocal

cd /d "%~dp0"

echo Starting Mobile Garage services...
echo - Inventory server (web + API)
echo - Print service
echo.

call npm run start

endlocal
