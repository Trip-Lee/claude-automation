@echo off
:: ServiceNow Tools - Quick Update
:: Quick update from temp_updates folder

echo =========================================
echo    ServiceNow - Quick Update
echo =========================================
echo.
echo This will update ServiceNow from files in:
echo SN-Updater\temp_updates\
echo.

cd /d "%~dp0SN-Updater"

:: Check if temp_updates directory exists
if not exist "temp_updates" (
    echo Creating temp_updates directory...
    mkdir temp_updates
    echo.
    echo Place your update files in: %cd%\temp_updates\
    echo File naming convention: type_sysid_field.js
    echo Example: script_include_abc123_script.js
    echo.
    pause
    exit /b 0
)

:: List files in temp_updates
echo Available files in temp_updates:
echo --------------------------------
dir /b temp_updates\*.js 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo No .js files found in temp_updates!
    echo.
    echo Place your update files in: %cd%\temp_updates\
    echo File naming convention: type_sysid_field.js
    echo.
    pause
    exit /b 0
)

echo.
echo Starting quick update interface...
echo.

node sn-tools-cli.js
cd /d "%~dp0"