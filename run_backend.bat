@echo off
REM Start backend from project root. Uses venv in backend folder.
cd /d "%~dp0"
if exist "backend\run_backend.bat" (
    call backend\run_backend.bat
) else (
    echo backend\run_backend.bat not found. Run from project root.
    pause
)
