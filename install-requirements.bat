@echo off
setlocal
cd /d "%~dp0"
echo Installing Mobile Garage dependencies (Node, Python)...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-requirements.ps1"
set ERR=%ERRORLEVEL%
if not %ERR%==0 (
  echo.
  echo Script exited with error %ERR%.
  pause
  exit /b %ERR%
)
echo.
pause
endlocal
