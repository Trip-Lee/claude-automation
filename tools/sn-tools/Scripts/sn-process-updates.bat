@echo off
:: ServiceNow Tools v2 - Process Pending Updates
:: Process all files in temp_updates folder

echo =========================================
echo    ServiceNow v2 - Process Updates
echo =========================================
echo.

cd /d "%~dp0..\ServiceNow-Tools"

:: Check if temp_updates directory exists
if not exist "temp_updates" (
    echo Creating temp_updates directory...
    mkdir temp_updates
)

echo Checking for pending updates in temp_updates\
echo.

dir /b temp_updates\*.js 2>nul >nul
if %ERRORLEVEL% NEQ 0 (
    echo No pending updates found.
    echo.
    echo To add updates:
    echo 1. Place .js files in: %cd%\temp_updates\
    echo 2. Name format: type_sysid_field.js
    echo    Example: script_include_abc123_script.js
    echo.
    pause
    exit /b 0
)

echo Found pending updates. Processing...
echo.

node sn-operations.js process-updates

cd /d "%~dp0"

echo.
echo =========================================
echo    Update processing complete!
echo =========================================
pause