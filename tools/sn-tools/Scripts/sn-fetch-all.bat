@echo off
:: ServiceNow Tools v2 - Fetch All Data
:: Fetches both data and stories using configured routing

echo =========================================
echo    ServiceNow v2 - Fetch All Data
echo =========================================
echo.

cd /d "%~dp0..\ServiceNow-Tools"

echo Fetching ServiceNow data (with instance routing)...
node sn-operations.js fetch-data
if %ERRORLEVEL% NEQ 0 (
    echo Data fetch failed!
    pause
    exit /b 1
)

echo.
echo Fetching ServiceNow stories (from configured instance)...
node sn-operations.js fetch-stories
if %ERRORLEVEL% NEQ 0 (
    echo Story fetch failed!
    pause
    exit /b 1
)

cd /d "%~dp0"

echo.
echo =========================================
echo    All data fetched successfully!
echo =========================================
pause