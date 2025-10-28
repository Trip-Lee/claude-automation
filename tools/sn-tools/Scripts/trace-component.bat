@echo off
setlocal enabledelayedexpansion

echo ========================================
echo     Component to Backend Tracer
echo ========================================
echo.

if "%1"=="" (
    set /p component="Enter component name (e.g., ConditionBuilder, Calendar): "
) else (
    set component=%1
)

echo.
echo Searching for component: %component%
echo.

:: Check Sashimono first
if exist "W:\Tenon\Tenon Repo\Sashimono\%component%" (
    echo ✓ Found in Sashimono
    set componentPath=W:\Tenon\Tenon Repo\Sashimono\%component%
) else if exist "W:\Tenon\Tenon Repo\component-library\%component%" (
    echo ✓ Found in component-library
    set componentPath=W:\Tenon\Tenon Repo\component-library\%component%
) else (
    echo ✗ Component not found
    echo.
    echo Available Sashimono components:
    dir /b "W:\Tenon\Tenon Repo\Sashimono" | findstr /v "node_modules package"
    echo.
    echo Available component-library components:
    dir /b "W:\Tenon\Tenon Repo\component-library" | findstr /v "node_modules package _"
    exit /b 1
)

echo.
echo Component Path: %componentPath%
echo.

:: Search for API calls
echo Searching for API calls...
echo.

:: Look for createHttpEffect patterns
findstr /s /i "createHttpEffect.*api/x_cadso" "%componentPath%\*.js" 2>nul
if %errorlevel%==0 (
    echo.
    echo Found API calls above. Check the files for endpoint details.
) else (
    echo No direct API calls found. Component may use indirect dispatch.
)

echo.
echo ========================================
echo.
echo Next steps:
echo 1. Look for the API endpoint in the createHttpEffect calls
echo 2. Search for REST API: dir "W:\Tenon\ServiceNow Data\Tenon\Rest_API's\*\*.json" ^| findstr /i [endpoint]
echo 3. Check operation_script in the REST API JSON for Script Include name
echo 4. Find Script Include: dir "W:\Tenon\ServiceNow Data\Tenon\Script_Includes\*\*.json" ^| findstr [ScriptInclude]
echo.
pause