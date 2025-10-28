@echo off
REM ServiceNow Tools Autonomous Agent System
REM Launcher script for autonomous operations

setlocal enabledelayedexpansion
cd /d "%~dp0"

title ServiceNow Autonomous Agents

echo.
echo ============================================================
echo ServiceNow Tools - Autonomous Agent System
echo ============================================================
echo.

REM Check if Node.js is available
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js and try again
    pause
    exit /b 1
)

REM Display menu
:menu
cls
echo ============================================================
echo ServiceNow Tools - Autonomous Agent System
echo ============================================================
echo.
echo 1. Start Autonomous Operations
echo 2. Stop Autonomous Operations
echo 3. Check System Status
echo 4. View Agent Status
echo 5. Queue Manual Task
echo 6. Trigger Learning Cycle
echo 7. View Configuration
echo 8. Emergency Stop
echo 9. View Logs
echo.
echo === AUTONOMY CONTROLS ===
echo A. Check Autonomy Status
echo B. Enable Autonomy
echo C. Disable Autonomy  
echo D. Reset Autonomy Settings
echo.
echo 0. Exit
echo.
set /p choice="Enter your choice (0-9, A-D): "

if "%choice%"=="1" goto start
if "%choice%"=="2" goto stop
if "%choice%"=="3" goto status
if "%choice%"=="4" goto agents
if "%choice%"=="5" goto queue
if "%choice%"=="6" goto learn
if "%choice%"=="7" goto config
if "%choice%"=="8" goto emergency
if "%choice%"=="9" goto logs
if /i "%choice%"=="A" goto autonomy_status
if /i "%choice%"=="B" goto enable_autonomy
if /i "%choice%"=="C" goto disable_autonomy
if /i "%choice%"=="D" goto reset_autonomy
if "%choice%"=="0" goto exit

echo Invalid choice. Please try again.
timeout /t 2 >nul
goto menu

:start
echo.
echo Starting Autonomous Operations...
node sn-autonomous-integration.js start
if errorlevel 1 (
    echo ERROR: Failed to start autonomous operations
    pause
    goto menu
)
echo.
echo Autonomous operations started successfully!
echo Press any key to return to menu...
pause >nul
goto menu

:stop
echo.
echo Stopping Autonomous Operations...
node sn-autonomous-integration.js stop
echo.
echo Autonomous operations stopped.
echo Press any key to return to menu...
pause >nul
goto menu

:status
echo.
echo Checking System Status...
node sn-autonomous-integration.js status
echo.
echo Press any key to return to menu...
pause >nul
goto menu

:agents
echo.
echo Viewing Agent Status...
node sn-autonomous-integration.js agents
echo.
echo Press any key to return to menu...
pause >nul
goto menu

:queue
echo.
echo Available task types:
echo - analyze
echo - monitor
echo - execute
echo - investigate
echo - optimize
echo.
set /p task_type="Enter task type: "
set /p task_target="Enter task target (optional): "
set /p task_priority="Enter priority (normal/high/critical): "

if "%task_priority%"=="" set task_priority=normal

echo.
echo Queuing task: %task_type% %task_target% %task_priority%
node sn-autonomous-integration.js queue "%task_type%" "%task_target%" "%task_priority%"
echo.
echo Press any key to return to menu...
pause >nul
goto menu

:learn
echo.
echo Triggering Learning Cycle...
node sn-autonomous-integration.js learn
echo.
echo Press any key to return to menu...
pause >nul
goto menu

:config
echo.
echo Current Configuration:
echo ============================================================
type agent-configs\orchestrator-config.json
echo.
echo ============================================================
echo Press any key to return to menu...
pause >nul
goto menu

:emergency
echo.
echo *** EMERGENCY STOP ***
echo This will immediately terminate all autonomous operations
echo and create an emergency backup.
echo.
set /p confirm="Are you sure? (y/N): "
if /i not "%confirm%"=="y" goto menu

echo.
echo Executing emergency stop...
taskkill /f /im node.exe >nul 2>&1
echo Emergency stop completed.
echo.
echo Press any key to return to menu...
pause >nul
goto menu

:logs
echo.
echo Recent Autonomous Agent Logs:
echo ============================================================
if exist logs\orchestrator.log (
    echo [ORCHESTRATOR LOG]
    powershell -Command "Get-Content logs\orchestrator.log | Select-Object -Last 20"
    echo.
)

if exist logs\agent-monitor.log (
    echo [MONITOR AGENT LOG]
    powershell -Command "Get-Content logs\agent-monitor.log | Select-Object -Last 10"
    echo.
)

if exist logs\alerts.log (
    echo [ALERTS LOG]
    powershell -Command "Get-Content logs\alerts.log | Select-Object -Last 10"
    echo.
)

echo ============================================================
echo Press any key to return to menu...
pause >nul
goto menu

:autonomy_status
echo.
echo Checking Autonomy Status...
node sn-autonomous-integration.js autonomy status
echo.
echo Press any key to return to menu...
pause >nul
goto menu

:enable_autonomy
echo.
echo *** ENABLING AUTONOMY ***
echo This will allow the system to make autonomous decisions
echo and perform actions automatically.
echo.
set /p reason="Enter reason (optional): "
if "%reason%"=="" set reason="Manual enable via CLI"

echo.
echo Enabling autonomy with reason: %reason%
node sn-autonomous-integration.js autonomy enable "%reason%"
echo.
echo Press any key to return to menu...
pause >nul
goto menu

:disable_autonomy
echo.
echo *** DISABLING AUTONOMY ***
echo This will prevent the system from making autonomous decisions.
echo All operations will require manual approval.
echo.
set /p reason="Enter reason (optional): "
if "%reason%"=="" set reason="Manual disable via CLI"

echo.
echo Disabling autonomy with reason: %reason%
node sn-autonomous-integration.js autonomy disable "%reason%"
echo.
echo Press any key to return to menu...
pause >nul
goto menu

:reset_autonomy
echo.
echo *** RESETTING AUTONOMY SETTINGS ***
echo This will reset autonomy to default settings and clear
echo emergency disable flags.
echo.
set /p confirm="Are you sure? (y/N): "
if /i not "%confirm%"=="y" goto menu

echo.
echo Resetting autonomy settings...
node sn-autonomous-integration.js autonomy reset
echo.
echo Press any key to return to menu...
pause >nul
goto menu

:exit
echo.
echo Goodbye!
exit /b 0