@echo off
setlocal enabledelayedexpansion

REM =============================================
REM ServiceNow Record Creator
REM =============================================

echo.
echo =========================================
echo      ServiceNow Record Creator
echo =========================================
echo.

REM Check if parameters were provided for command-line usage
if not "%~1"=="" goto :DIRECT_CREATE

:MENU
echo Select table type:
echo.
echo 1. Script Include (sys_script_include)
echo 2. REST API (sys_ws_operation)
echo 3. Business Rule (sys_script)
echo 4. UI Action (sys_ui_action)
echo 5. Client Script (sys_script_client)
echo 6. Custom table (enter table name)
echo.
set /p TABLE_CHOICE="Enter choice (1-6): "

if "%TABLE_CHOICE%"=="1" set TABLE=sys_script_include
if "%TABLE_CHOICE%"=="2" set TABLE=sys_ws_operation
if "%TABLE_CHOICE%"=="3" set TABLE=sys_script
if "%TABLE_CHOICE%"=="4" set TABLE=sys_ui_action
if "%TABLE_CHOICE%"=="5" set TABLE=sys_script_client
if "%TABLE_CHOICE%"=="6" (
    set /p TABLE="Enter table name: "
)

echo.
echo How do you want to provide the data?
echo.
echo 1. From JSON file
echo 2. Enter field values manually
echo.
set /p DATA_CHOICE="Enter choice (1-2): "

if "%DATA_CHOICE%"=="1" goto :JSON_INPUT
if "%DATA_CHOICE%"=="2" goto :MANUAL_INPUT

:JSON_INPUT
echo.
set /p JSON_FILE="Enter path to JSON file: "
echo.
echo Creating record from JSON file...
cd /d "%~dp0..\ServiceNow-Tools"
node sn-operations.js create --table %TABLE% --data "%JSON_FILE%"
goto :END

:MANUAL_INPUT
echo.
echo Enter field values (press Enter without value to finish):
echo.
set FIELD_ARGS=

:FIELD_LOOP
set /p FIELD_NAME="Field name (or press Enter to finish): "
if "%FIELD_NAME%"=="" goto :EXECUTE_CREATE

set /p FIELD_VALUE="Value for %FIELD_NAME%: "
set FIELD_ARGS=!FIELD_ARGS! --field "%FIELD_NAME%" --value "%FIELD_VALUE%"
goto :FIELD_LOOP

:EXECUTE_CREATE
echo.
echo Creating record...
cd /d "%~dp0..\ServiceNow-Tools"
node sn-operations.js create --table %TABLE% %FIELD_ARGS%
goto :END

:DIRECT_CREATE
REM Direct command-line execution
cd /d "%~dp0..\ServiceNow-Tools"
node sn-operations.js create %*

:END
echo.
pause