@echo off
REM Run backend with venv (Windows). Double-click from project root OR from backend folder.
cd /d "%~dp0"
if not exist "venv\Scripts\activate.bat" (
    echo Creating venv...
    python -m venv venv 2>nul || py -3 -m venv venv
    if not exist "venv\Scripts\activate.bat" ( echo Failed to create venv. Install Python and try again. & pause & exit /b 1 )
    call venv\Scripts\activate.bat
    echo Installing dependencies...
    pip install -r requirements.txt
) else (
    call venv\Scripts\activate.bat
)
echo.
echo Backend at http://127.0.0.1:5000  (keep this window open)
echo Press Ctrl+C to stop.
echo.
python start_server.py 2>nul || py -3 start_server.py
if errorlevel 1 ( echo. & echo Server exited. Check errors above. & pause )
pause
