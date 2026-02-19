@echo off
title Backend Server - NextGen Data Architects
color 0A

echo ================================================================================
echo   NextGen Data Architects - Backend Server
echo ================================================================================
echo.
echo   Starting Flask Backend Server...
echo   Server URL: http://localhost:5000
echo.
echo   Press Ctrl+C to stop the server
echo ================================================================================
echo.

cd /d "%~dp0backend"

REM Activate virtual environment if it exists
if exist ".venv\Scripts\activate.bat" (
    call .venv\Scripts\activate.bat
)

python start_server.py

if errorlevel 1 (
    echo.
    echo ================================================================================
    echo   ERROR: Server failed to start
    echo ================================================================================
    pause
)

