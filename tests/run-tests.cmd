@echo off
rem Runs the bengusa.pro tests on the files as they are now, saved or not:
rem the settings test, a fresh build of the site, then the browser tests.
rem Double-click it, or run it from a console. Takes a few minutes.
rem (scripts\release\gate.cmd is the stricter check: it tests the last commit in a clean copy.)
rem Node 24 is not on the system PATH, so add it for this window only (as src\dev.cmd does).
setlocal
set "PATH=%LOCALAPPDATA%\Programs\nodejs24;%PATH%"
set "NEXT_TELEMETRY_DISABLED=1"
title bengusa.pro tests
cd /d "%~dp0"

if not exist "%LOCALAPPDATA%\Programs\nodejs24\node.exe" (
    echo Node 24 was not found at %LOCALAPPDATA%\Programs\nodejs24
    goto :fail
)

rem First run on this PC: install the site's parts and the test tool.
if not exist "..\src\node_modules\next\" (
    echo Installing the site's parts...
    pushd "..\src"
    call npm ci
    if errorlevel 1 goto :fail
    popd
)
if not exist "node_modules\@playwright\test\" (
    echo Installing the test tool...
    call npm ci
    if errorlevel 1 goto :fail
)
rem Fetches the test browsers only if they are missing.
call npx --no-install playwright install chromium webkit
if errorlevel 1 goto :fail

call npm test
set "RC=%ERRORLEVEL%"
echo.
if "%RC%"=="0" (echo TESTS PASSED.) else (echo TESTS FAILED. Scroll up to see which test failed.)
pause
exit /b %RC%

:fail
echo.
echo Could not start the tests (see above). Nothing was changed.
pause
exit /b 1
