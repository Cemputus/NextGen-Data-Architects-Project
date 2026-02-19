@echo off
echo ============================================================
echo Starting Backend Server
echo ============================================================
cd /d "%~dp0"
call .venv\Scripts\activate.bat
if errorlevel 1 (
    echo ERROR: Failed to activate virtual environment
    echo Make sure .venv exists. Run: python -m venv .venv
    pause
    exit /b 1
)
echo Virtual environment activated
echo.
echo Starting Flask server...
echo Server will be available at: http://localhost:5000
echo Press Ctrl+C to stop the server
echo ============================================================
echo.
python start_server.py
pause

