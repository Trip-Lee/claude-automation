@echo off
:: ServiceNow Updater Launcher
:: This script launches the updater from the SN-Updater folder

cd /d "%~dp0SN-Updater"
call update-servicenow.bat
cd /d "%~dp0"