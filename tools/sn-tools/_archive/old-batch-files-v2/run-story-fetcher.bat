@echo off
:: ServiceNow Story Fetcher Launcher
echo ========================================
echo     ServiceNow Story Fetcher
echo ========================================
echo.

cd /d "%~dp0SN-StoryFetcher"

echo Checking Node version...
node --version

echo.
echo Running Story Fetcher...
node sn-fetcher.js

echo.
echo Story fetch completed!
pause