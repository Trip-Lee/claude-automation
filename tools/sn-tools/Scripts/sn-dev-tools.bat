@echo off
:: ServiceNow Development Tools - Enhanced Automation
:: Access to all advanced development features

:menu
cls
echo ╔═══════════════════════════════════════╗
echo ║    ServiceNow Development Tools       ║
echo ╚═══════════════════════════════════════╝
echo.
echo 1. Run All (Auto-execute everything)
echo 2. File Watcher (Watch and auto-update)
echo 3. Dependency Analysis
echo 4. Impact Analysis
echo 5. Test Connections
echo 6. Process Updates Only
echo 7. Generate Context Summary (for Claude)
echo 8. Development Session Report
echo 9. Configuration Setup
echo 0. Exit
echo.

set /p choice="Select option: "

cd /d "%~dp0..\ServiceNow-Tools"

if "%choice%"=="1" goto run_all
if "%choice%"=="2" goto file_watcher
if "%choice%"=="3" goto dependency
if "%choice%"=="4" goto impact
if "%choice%"=="5" goto test
if "%choice%"=="6" goto updates
if "%choice%"=="7" goto context
if "%choice%"=="8" goto report
if "%choice%"=="9" goto setup
if "%choice%"=="0" goto exit

echo Invalid selection. Press any key to continue...
pause >nul
goto menu

:run_all
echo =========================================
echo    Running All Operations
echo =========================================
echo.
node sn-auto-execute.js
echo.
echo Press any key to continue...
pause >nul
goto menu

:file_watcher
echo =========================================
echo    File Watcher
echo =========================================
echo.
echo Choose mode:
echo 1. Watch only (manual updates)
echo 2. Watch and auto-update
echo.
set /p watch_choice="Select mode: "

if "%watch_choice%"=="1" (
    echo Starting file watcher (manual mode)...
    node sn-file-watcher.js watch
) else if "%watch_choice%"=="2" (
    echo Starting file watcher (auto-update mode)...
    node sn-file-watcher.js watch --auto-update
) else (
    echo Invalid choice.
    pause
    goto menu
)
goto menu

:dependency
echo =========================================
echo    Dependency Analysis
echo =========================================
echo.
echo 1. Full Scan (scan entire codebase)
echo 2. View Dependency Graph
echo 3. Find Dependencies for Item
echo.
set /p dep_choice="Select option: "

if "%dep_choice%"=="1" (
    node sn-dependency-tracker.js scan
) else if "%dep_choice%"=="2" (
    node sn-dependency-tracker.js graph
) else if "%dep_choice%"=="3" (
    set /p item="Enter item name: "
    node sn-dependency-tracker.js depends-on !item!
) else (
    echo Invalid choice.
)
echo.
echo Press any key to continue...
pause >nul
goto menu

:impact
echo =========================================
echo    Impact Analysis
echo =========================================
echo.
set /p script_name="Enter Script Include name to analyze: "
if not "%script_name%"=="" (
    node sn-dependency-tracker.js impact %script_name%
) else (
    echo No name provided.
)
echo.
echo Press any key to continue...
pause >nul
goto menu

:test
echo =========================================
echo    Connection Test
echo =========================================
echo.
node sn-operations.js test
echo.
echo Press any key to continue...
pause >nul
goto menu

:updates
echo =========================================
echo    Process Updates Only
echo =========================================
echo.
node sn-operations.js process-updates
echo.
echo Press any key to continue...
pause >nul
goto menu

:context
echo =========================================
echo    Generate Context Summary
echo =========================================
echo.
node sn-claude-helper.js summary
echo.
echo Context summary generated: claude-summary.md
echo This helps Claude understand your current development state.
echo.
echo Press any key to continue...
pause >nul
goto menu

:report
echo =========================================
echo    Development Session Report
echo =========================================
echo.
node sn-claude-helper.js report
echo.
echo Session report generated: session-report.json
echo.
echo Press any key to continue...
pause >nul
goto menu

:setup
echo =========================================
echo    Configuration Setup
echo =========================================
echo.
if exist sn-config.json (
    echo Configuration exists. Opening for editing...
    notepad sn-config.json
) else (
    echo Creating new configuration...
    node sn-auto-execute.js 2>nul
    if exist sn-config.example.json (
        copy sn-config.example.json sn-config.json >nul
        notepad sn-config.json
    ) else (
        echo Failed to create configuration template.
    )
)
echo.
echo Press any key to continue...
pause >nul
goto menu

:exit
cd /d "%~dp0"
exit /b 0