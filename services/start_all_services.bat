@echo off
echo ================================================================================
echo NextGen Data Architects - Starting All Services
echo ================================================================================
echo.

cd /d "%~dp0"

echo Opening service windows...
echo.

REM Start Backend Server
echo [1/2] Starting Backend Server...
start "Backend Server - Port 5000" cmd /k "cd /d %~dp0backend && python start_server.py"

timeout /t 3 /nobreak >nul

REM Start Frontend (if needed)
echo [2/2] Starting Frontend Server...
start "Frontend Server - Port 3000" cmd /k "cd /d %~dp0frontend && npm start"

echo.
echo ================================================================================
echo All services are starting in separate windows
echo ================================================================================
echo.
echo Backend:  http://localhost:5000
echo Frontend: http://localhost:3000
echo.
echo Close the windows to stop the services
echo ================================================================================
pause

