@echo off
:: ServiceNow Data Fetcher Launcher
echo ========================================
echo     ServiceNow Data Fetcher
echo ========================================
echo.

cd /d "%~dp0SN - DataFetcher"

echo Checking Node version...
node --version

echo.
echo Installing dependencies if needed...
if not exist "node_modules" (
    echo Installing npm packages...
    npm install
)

echo.
echo Running Data Fetcher...
node index.js

echo.
echo Data extraction completed!
pause