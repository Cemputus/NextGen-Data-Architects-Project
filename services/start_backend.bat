@echo off
echo ================================================================================
echo Starting NextGen Data Architects Backend Server
echo ================================================================================
echo.

cd /d "%~dp0backend"

echo Starting Flask Backend Server...
echo Server will be available at: http://localhost:5000
echo.
echo Press Ctrl+C in this window to stop the server
echo ================================================================================
echo.

python start_server.py

pause

