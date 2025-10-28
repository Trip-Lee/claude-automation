@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0\..\ServiceNow-Tools"

echo ========================================
echo ServiceNow REST API Tracer
echo ========================================
echo.

if "%1"=="" (
    echo Usage:
    echo   sn-trace-api.bat component "Component Name"
    echo   sn-trace-api.bat sysids sys_id1 sys_id2 sys_id3...
    echo.
    echo Examples:
    echo   sn-trace-api.bat component "Audience Builder"
    echo   sn-trace-api.bat component "Kanban"
    echo   sn-trace-api.bat sysids 05afff0087ab0a10369f33373cbb3586
    echo.
    pause
    exit /b 1
)

if "%1"=="component" (
    if "%2"=="" (
        echo Error: Component name required
        echo Example: sn-trace-api.bat component "Audience Builder"
        pause
        exit /b 1
    )
    echo Tracing APIs for component: %~2
    echo.
    node fetch-rest-api-details.js component "%~2"
) else if "%1"=="sysids" (
    if "%2"=="" (
        echo Error: At least one sys_id required
        echo Example: sn-trace-api.bat sysids 05afff0087ab0a10369f33373cbb3586
        pause
        exit /b 1
    )
    echo Fetching API details for sys_ids: %*
    echo.
    node fetch-rest-api-details.js %*
) else (
    echo Error: Unknown command "%1"
    echo Use "component" or "sysids"
    pause
    exit /b 1
)

echo.
echo ========================================
echo Trace complete! Check temp_updates/ folder for detailed results.
echo ========================================
pause