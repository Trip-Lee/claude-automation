@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0\..\ServiceNow-Tools"

echo ========================================
echo ServiceNow Comprehensive Component Tracer
echo ========================================
echo.
echo This will trace:
echo  1. Main component location and APIs
echo  2. Sashimono dependencies and their APIs  
echo  3. Complete Script Include mapping
echo  4. MS pattern analysis
echo  5. Comprehensive data flow summary
echo.

if "%1"=="" (
    echo Usage:
    echo   sn-trace-comprehensive.bat "Component Name"
    echo.
    echo Examples:
    echo   sn-trace-comprehensive.bat "Audience Builder"
    echo   sn-trace-comprehensive.bat "Kanban"
    echo   sn-trace-comprehensive.bat "Calendar"
    echo.
    pause
    exit /b 1
)

echo Tracing component with Sashimono dependencies: %~1
echo.

node sn-claude-helper.js trace "%~1"

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo ✅ Comprehensive trace completed successfully!
    echo ========================================
    echo.
    echo Check these locations for results:
    echo   📄 temp_updates/%~1_comprehensive_trace_summary.md
    echo   📁 temp_updates/*_complete.json
    echo.
    echo The trace included:
    echo   • Main component analysis
    echo   • Sashimono dependency discovery  
    echo   • REST API endpoint mapping
    echo   • Script Include relationships
    echo   • MS pattern compliance analysis
    echo.
) else (
    echo.
    echo ========================================
    echo ❌ Trace failed with error level %errorlevel%
    echo ========================================
    echo.
    echo Check these for troubleshooting:
    echo   📄 ServiceNow-Tools/claude-errors.log
    echo   ⚙️  ServiceNow-Tools/sn-config.json
    echo.
)

pause