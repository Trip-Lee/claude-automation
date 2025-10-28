@echo off
setlocal enabledelayedexpansion

echo ========================================
echo     Node Version Switcher for Tenon
echo ========================================
echo.

:: Check if nvm is available
where nvm >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: nvm is not in PATH
    echo Please ensure W:\Tenon\nvm is added to your PATH
    exit /b 1
)

:: Display current version
for /f "tokens=*" %%i in ('node -v 2^>nul') do set CURRENT_VERSION=%%i
if defined CURRENT_VERSION (
    echo Current Node version: %CURRENT_VERSION%
) else (
    echo No Node version currently active
)
echo.

:: Show menu
echo Select Node version:
echo   1. ServiceNow Development (v12.22.12) - Required for ServiceNow components
echo   2. Modern Tooling (v22.11.0) - For build tools and scripts
echo   3. Show current version
echo   4. Exit
echo.

set /p choice="Enter your choice (1-4): "

if "%choice%"=="1" (
    echo.
    echo Switching to Node v12.22.12 for ServiceNow development...
    call nvm use 12.22.12
    echo.
    echo ✓ Switched to Node v12.22.12
    echo Use this version when:
    echo   - Building ServiceNow UI components
    echo   - Running 'snc' commands
    echo   - Deploying to ServiceNow instance
) else if "%choice%"=="2" (
    echo.
    echo Switching to Node v22.11.0 for modern tooling...
    call nvm use 22.11.0
    echo.
    echo ✓ Switched to Node v22.11.0
    echo Use this version when:
    echo   - Running build scripts
    echo   - Using modern development tools
    echo   - Working with non-ServiceNow utilities
) else if "%choice%"=="3" (
    echo.
    node -v
    npm -v
) else if "%choice%"=="4" (
    echo Exiting...
    exit /b 0
) else (
    echo Invalid choice. Please run the script again.
    exit /b 1
)

echo.
echo ========================================
pause