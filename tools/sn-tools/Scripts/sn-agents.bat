@echo off
setlocal enabledelayedexpansion

REM ServiceNow Multi-Agent System - Intelligent analysis across all layers
REM Coordinates multiple specialized agents for comprehensive insights

title ServiceNow Agent System

cd /d "%~dp0\..\ServiceNow-Tools"

if "%1"=="" (
    echo.
    echo ==========================================
    echo ServiceNow Multi-Agent System
    echo ==========================================
    echo.
    node sn-agents.js
) else if "%1"=="trace" (
    if "%2"=="" (
        echo Error: Please provide a story number
        echo Usage: sn-agents trace [story-number]
        exit /b 1
    )
    node sn-agents.js trace %2
) else if "%1"=="validate" (
    if "%2"=="" (
        echo Error: Please provide a story number
        echo Usage: sn-agents validate [story-number]
        exit /b 1
    )
    node sn-agents.js validate %2
) else if "%1"=="impact" (
    if "%2"=="" (
        echo Error: Please provide a component name
        echo Usage: sn-agents impact [component-name]
        exit /b 1
    )
    node sn-agents.js impact %2
) else if "%1"=="health" (
    node sn-agents.js health
) else if "%1"=="help" (
    echo.
    echo ServiceNow Multi-Agent System - Help
    echo =====================================
    echo.
    echo This system uses specialized agents to analyze different aspects of your
    echo ServiceNow application:
    echo.
    echo - Story Agent: Analyzes user stories and requirements
    echo - Component Agent: Analyzes UI components and dependencies
    echo - Orchestrator Agent: Coordinates between agents for complete analysis
    echo.
    echo Usage:
    echo   sn-agents                        - Launch interactive menu
    echo   sn-agents trace [story]          - Trace story to implementation
    echo   sn-agents validate [story]       - Validate story implementation
    echo   sn-agents impact [component]     - Analyze component impact
    echo   sn-agents health                 - Check system health
    echo   sn-agents help                   - Show this help
    echo.
    echo Examples:
    echo   sn-agents                        - Interactive mode
    echo   sn-agents trace STORY0001        - Trace story STORY0001
    echo   sn-agents impact kanban          - Analyze kanban component impact
    echo   sn-agents health                 - Check all agents status
    echo.
) else (
    echo Unknown command: %1
    echo Use "sn-agents help" for usage information
    exit /b 1
)

endlocal