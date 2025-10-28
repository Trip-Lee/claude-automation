@echo off
:: ServiceNow Tools v2 - Test Connections
:: Test connections to all configured instances

echo =========================================
echo    ServiceNow v2 - Connection Test
echo =========================================
echo.

cd /d "%~dp0..\ServiceNow-Tools"

node sn-operations.js test

cd /d "%~dp0"

echo.
pause