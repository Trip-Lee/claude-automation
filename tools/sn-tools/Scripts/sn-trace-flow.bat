@echo off
setlocal enabledelayedexpansion

REM ServiceNow Flow Tracer - Interactive flow analysis tool
REM Helps trace data flow from UI Components to Backend Script Includes

title ServiceNow Flow Tracer

cd /d "%~dp0\..\ServiceNow-Tools"

if "%1"=="" (
    echo.
    echo ========================================
    echo ServiceNow Flow Tracer - Interactive Mode
    echo ========================================
    echo.
    node sn-flow-tracer.js
) else if "%1"=="component" (
    if "%2"=="" (
        echo Error: Please provide a component name
        echo Usage: sn-trace-flow component [name]
        exit /b 1
    )
    node sn-flow-tracer.js component %2
) else if "%1"=="comp" (
    if "%2"=="" (
        echo Error: Please provide a component name
        echo Usage: sn-trace-flow comp [name]
        exit /b 1
    )
    node sn-flow-tracer.js component %2
) else if "%1"=="api" (
    if "%2"=="" (
        echo Error: Please provide an API name or path
        echo Usage: sn-trace-flow api [name/path]
        exit /b 1
    )
    node sn-flow-tracer.js api %2
) else if "%1"=="script" (
    if "%2"=="" (
        echo Error: Please provide a Script Include name
        echo Usage: sn-trace-flow script [name]
        exit /b 1
    )
    node sn-flow-tracer.js script %2
) else if "%1"=="si" (
    if "%2"=="" (
        echo Error: Please provide a Script Include name
        echo Usage: sn-trace-flow si [name]
        exit /b 1
    )
    node sn-flow-tracer.js script %2
) else if "%1"=="search" (
    if "%2"=="" (
        echo Error: Please provide a search term
        echo Usage: sn-trace-flow search [term]
        exit /b 1
    )
    node sn-flow-tracer.js search %2
) else if "%1"=="export" (
    if "%2"=="" (
        node sn-flow-tracer.js export all
    ) else (
        node sn-flow-tracer.js export %2
    )
) else if "%1"=="help" (
    echo.
    echo ServiceNow Flow Tracer - Help
    echo ==============================
    echo.
    echo Usage:
    echo   sn-trace-flow                        - Launch interactive menu
    echo   sn-trace-flow component [name]       - Trace component to API to Script Include
    echo   sn-trace-flow comp [name]            - Short alias for component
    echo   sn-trace-flow api [name/path]        - Trace API to Script Include
    echo   sn-trace-flow script [name]          - Find Script Include usage (reverse trace)
    echo   sn-trace-flow si [name]              - Short alias for script
    echo   sn-trace-flow search [term]          - Search all components, APIs, and Script Includes
    echo   sn-trace-flow export [name^|all]     - Export flow report for component or all
    echo   sn-trace-flow help                   - Show this help message
    echo.
    echo Examples:
    echo   sn-trace-flow                        - Interactive mode with menu
    echo   sn-trace-flow component kanban       - Trace the kanban component flow
    echo   sn-trace-flow api USER_FETCH         - Trace USER_FETCH API endpoint
    echo   sn-trace-flow script UserUtils       - Find where UserUtils is used
    echo   sn-trace-flow search email           - Search for anything containing "email"
    echo   sn-trace-flow export kanban          - Export flow report for kanban component
    echo.
) else (
    echo Unknown command: %1
    echo Use "sn-trace-flow help" for usage information
    exit /b 1
)

endlocal