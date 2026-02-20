@echo off
cd /d "%~dp0"
echo ========================================
echo  NextGen Backend - Starting...
echo ========================================

if not exist "venv\Scripts\activate.bat" (
    echo Creating venv...
    python -m venv venv 2>nul || py -3 -m venv venv
    if not exist "venv\Scripts\activate.bat" (
        echo ERROR: Could not create venv. Install Python 3 and try again.
        pause
        exit /b 1
    )
    call venv\Scripts\activate.bat
    echo Installing dependencies...
    pip install -r requirements.txt
) else (
    call venv\Scripts\activate.bat
)

echo.
echo Checking app loads...
python -c "from app import app; print('App OK')" 2>nul || py -3 -c "from app import app; print('App OK')" 2>nul
if errorlevel 1 (
    echo ERROR: App failed to load. Check the error above.
    pause
    exit /b 1
)

echo.
echo Starting server on http://127.0.0.1:5000
echo KEEP THIS WINDOW OPEN. Frontend calls this URL - if you close it, you will see "Backend not reachable".
echo Then start frontend: cd frontend, npm start
echo ========================================
python start_server.py 2>nul || py -3 start_server.py
if errorlevel 1 (
    echo.
    echo Server stopped with an error. See above.
)
pause
