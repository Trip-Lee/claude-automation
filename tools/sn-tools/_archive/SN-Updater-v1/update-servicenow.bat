@echo off
setlocal enabledelayedexpansion

echo ========================================
echo     ServiceNow Update Assistant
echo ========================================
echo.

:: Check if sn-config.json exists
if not exist "%~dp0sn-config.json" (
    echo Error: sn-config.json not found!
    echo Please copy sn-config.example.json to sn-config.json and update with your credentials.
    pause
    exit /b 1
)

:: Menu
echo What would you like to update?
echo   1. Script Include
echo   2. REST API Operation Script
echo   3. Business Rule
echo   4. Client Script
echo   5. UI Action
echo   6. Exit
echo.

set /p choice="Enter your choice (1-6): "

if "%choice%"=="1" (
    set type=script_include
    set field=script
    set record_type=Script Include
) else if "%choice%"=="2" (
    set type=rest_api
    set field=operation_script
    set record_type=REST API
) else if "%choice%"=="3" (
    set type=business_rule
    set field=script
    set record_type=Business Rule
) else if "%choice%"=="4" (
    set type=client_script
    set field=script
    set record_type=Client Script
) else if "%choice%"=="5" (
    set type=ui_action
    set field=script
    set record_type=UI Action
) else if "%choice%"=="6" (
    echo Exiting...
    exit /b 0
) else (
    echo Invalid choice!
    pause
    exit /b 1
)

echo.
echo Selected: %record_type%
echo.

:: Get sys_id
set /p sys_id="Enter the sys_id of the %record_type%: "

if "%sys_id%"=="" (
    echo Error: sys_id is required!
    pause
    exit /b 1
)

echo.
echo How would you like to provide the update?
echo   1. From a file
echo   2. Open editor to write/paste code
echo.

set /p input_choice="Enter your choice (1-2): "

if "%input_choice%"=="1" (
    set /p file_path="Enter the file path (relative to SN-Updater folder or absolute): "
    
    :: Check if file exists relative to script directory
    if exist "%~dp0!file_path!" (
        set file_path=%~dp0!file_path!
    )
    
    if not exist "!file_path!" (
        echo Error: File not found!
        pause
        exit /b 1
    )
    
    echo.
    echo Updating %record_type%...
    cd /d "%~dp0"
    node servicenow-updater.js --type %type% --sys_id %sys_id% --field %field% --file "!file_path!"
    
) else if "%input_choice%"=="2" (
    :: Create temp file for editing
    set temp_file=%~dp0temp_updates\sn_update_%RANDOM%.js
    
    :: Ensure temp_updates directory exists
    if not exist "%~dp0temp_updates" mkdir "%~dp0temp_updates"
    
    echo // Paste or write your %record_type% code here > !temp_file!
    echo // Save and close when done >> !temp_file!
    echo. >> !temp_file!
    
    :: Open in default editor
    start /wait notepad !temp_file!
    
    echo.
    echo Updating %record_type%...
    cd /d "%~dp0"
    node servicenow-updater.js --type %type% --sys_id %sys_id% --field %field% --file "!temp_file!"
    
    :: Clean up temp file
    del !temp_file!
) else (
    echo Invalid choice!
    pause
    exit /b 1
)

echo.
echo ========================================
pause