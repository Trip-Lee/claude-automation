@echo off
:: ServiceNow Tools - Cross Platform
:: Unified launcher that works consistently across platforms

cd /d "%~dp0..\ServiceNow-Tools"

:: Use NVM Node if available, otherwise use system Node
if exist "%~dp0..\nvm\v22.11.0\node.exe" (
    "%~dp0..\nvm\v22.11.0\node.exe" sn-launcher.js %*
) else (
    node sn-launcher.js %*
)