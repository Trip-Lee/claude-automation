@echo off
:: ServiceNow File Watcher - Cross Platform
:: Unified file watcher launcher

cd /d "%~dp0..\ServiceNow-Tools"

:: Use NVM Node if available, otherwise use system Node
if exist "%~dp0..\nvm\v22.11.0\node.exe" (
    "%~dp0..\nvm\v22.11.0\node.exe" sn-launcher.js watch %*
) else (
    node sn-launcher.js watch %*
)