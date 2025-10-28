@echo off
REM Quick Autonomy Toggle Script

cd /d "%~dp0"

title ServiceNow Autonomy Toggle

echo.
echo ========================================
echo ServiceNow Tools - Autonomy Toggle
echo ========================================
echo.

REM Check current status
echo Checking current autonomy status...
node sn-autonomous-integration.js autonomy status

echo.
echo ========================================
echo Choose Action:
echo ========================================
echo 1. Enable Autonomy
echo 2. Disable Autonomy
echo 3. Emergency Stop
echo 4. Reset Settings
echo 5. Exit
echo.
set /p choice="Enter choice (1-5): "

if "%choice%"=="1" goto enable
if "%choice%"=="2" goto disable
if "%choice%"=="3" goto emergency
if "%choice%"=="4" goto reset
if "%choice%"=="5" goto exit

echo Invalid choice.
pause
goto exit

:enable
echo.
echo ENABLING AUTONOMY...
set /p reason="Reason (optional): "
node sn-autonomous-integration.js autonomy enable "%reason%"
echo.
echo ✓ Autonomy enabled successfully!
pause
goto exit

:disable
echo.
echo DISABLING AUTONOMY...
set /p reason="Reason (optional): "
node sn-autonomous-integration.js autonomy disable "%reason%"
echo.
echo ✓ Autonomy disabled successfully!
pause
goto exit

:emergency
echo.
echo *** EMERGENCY STOP ***
echo This will immediately disable all autonomous operations
echo.
set /p confirm="Confirm emergency stop (y/N): "
if /i not "%confirm%"=="y" goto exit

node sn-autonomous-integration.js emergency-stop "Emergency stop via toggle script"
echo.
echo *** EMERGENCY STOP ACTIVATED ***
pause
goto exit

:reset
echo.
echo RESETTING AUTONOMY SETTINGS...
node sn-autonomous-integration.js autonomy reset
echo.
echo ✓ Autonomy settings reset successfully!
pause
goto exit

:exit
exit /b 0