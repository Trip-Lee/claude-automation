@echo off
setlocal enabledelayedexpansion

title ServiceNow Dependency Visualizer

:: Color setup
color 0E

echo.
echo ╔════════════════════════════════════════════════╗
echo ║     ServiceNow Dependency Visualizer          ║
echo ╚════════════════════════════════════════════════╝
echo.

:: Check if node is available
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo Please install Node.js or run switch-node.bat first
    pause
    exit /b 1
)

:: Navigate to ServiceNow-Tools directory
cd /d "%~dp0..\ServiceNow-Tools"

:: Check if visualizer exists
if not exist "sn-dependency-visualizer.js" (
    echo [ERROR] Visualizer not found. Please ensure sn-dependency-visualizer.js exists
    pause
    exit /b 1
)

:: Display menu
:menu
echo Select visualization option:
echo.
echo   1. Generate Complete Interactive Graph
echo   2. Focus on Specific Component/API/Script
echo   3. Generate DOT Graph (for GraphViz)
echo   4. Export Graph as JSON
echo   5. Scan/Refresh Dependencies
echo   6. Quick Visualize (last scan data)
echo   7. Exit
echo.
set /p choice="Enter your choice (1-7): "

if "%choice%"=="1" goto generate_full
if "%choice%"=="2" goto generate_focus
if "%choice%"=="3" goto generate_dot
if "%choice%"=="4" goto export_json
if "%choice%"=="5" goto scan_deps
if "%choice%"=="6" goto quick_viz
if "%choice%"=="7" goto end

echo Invalid choice. Please try again.
echo.
goto menu

:generate_full
echo.
echo Generating complete interactive dependency graph...
echo.
echo Options:
echo   - Press Enter for all types
echo   - Or type: --no-components, --no-apis, --no-scripts
echo.
set /p options="Enter options (or press Enter for all): "
node sn-dependency-visualizer.js generate %options%
echo.
pause
goto menu

:generate_focus
echo.
set /p focus="Enter component/API/script name to focus on: "
set /p depth="Enter depth (default 2): "
if "%depth%"=="" set depth=2
echo.
echo Generating focused graph for: %focus% (depth: %depth%)...
node sn-dependency-visualizer.js focus "%focus%" %depth%
echo.
pause
goto menu

:generate_dot
echo.
echo Generating DOT graph for GraphViz...
node sn-dependency-visualizer.js dot
echo.
echo To convert to image, run:
echo   dot -Tpng dependency-graph-*.dot -o graph.png
echo.
pause
goto menu

:export_json
echo.
set /p focus="Enter focus item (or press Enter for all): "
set /p depth="Enter depth (default 3): "
if "%depth%"=="" set depth=3
echo.
echo Exporting graph data as JSON...
if "%focus%"=="" (
    node sn-dependency-visualizer.js json
) else (
    node sn-dependency-visualizer.js json "%focus%" %depth%
)
echo.
pause
goto menu

:scan_deps
echo.
echo Scanning codebase for dependencies...
echo This may take a few minutes...
echo.
node sn-dependency-visualizer.js scan
echo.
echo Scan complete! Now generating visualization...
node sn-dependency-visualizer.js generate
echo.
pause
goto menu

:quick_viz
echo.
echo Generating visualization from cached data...
node sn-dependency-visualizer.js generate
echo.
pause
goto menu

:end
echo.
echo Thank you for using ServiceNow Dependency Visualizer!
timeout /t 2 /nobreak >nul
exit /b 0