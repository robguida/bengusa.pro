@echo off
rem Local release gate for bengusa.pro. Double-click it, or run it from a console.
rem It tests the last COMMIT in a fresh temp copy, not unsaved changes, and it
rem does not disturb a running dev server. About 3 to 5 minutes.
rem Node 24 is not on the system PATH, so add it for this window only (as dev.cmd does).
setlocal
set "PATH=%LOCALAPPDATA%\Programs\nodejs24;%PATH%"
set "NEXT_TELEMETRY_DISABLED=1"
cd /d "%~dp0..\.."
node scripts\release\gate.mjs %*
set "RC=%ERRORLEVEL%"
echo.
if "%RC%"=="0" echo GATE PASSED. The summary above lists every step.
if not "%RC%"=="0" echo GATE FAILED. The summary above names the step that failed.
pause
exit /b %RC%
