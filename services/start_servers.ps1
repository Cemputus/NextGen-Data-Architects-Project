# Start Both Servers Script
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  NextGen-Data-Architects System" -ForegroundColor Cyan
Write-Host "  Starting Backend and Frontend" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if virtual environment exists in backend folder
if (-not (Test-Path "backend\.venv\Scripts\activate")) {
    Write-Host "✗ Virtual environment not found!" -ForegroundColor Red
    Write-Host "Creating virtual environment in backend folder..." -ForegroundColor Yellow
    Set-Location "backend"
    python -m venv .venv
    Set-Location ".."
}

# Activate virtual environment and start backend
Write-Host "Starting Backend Server (Flask)..." -ForegroundColor Green
$backendJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    Set-Location "backend"
    & ".venv\Scripts\activate"
    python app.py
}

# Start frontend
Write-Host "Starting Frontend Server (React)..." -ForegroundColor Green
$frontendJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    Set-Location "frontend"
    npm start
}

Write-Host ""
Write-Host "Servers are starting in the background..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Backend:  http://localhost:5000" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Waiting for servers to be ready..." -ForegroundColor Yellow

# Wait and check
Start-Sleep -Seconds 10

$backendReady = $false
$frontendReady = $false

# Check backend
for ($i = 0; $i -lt 10; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5000" -Method GET -TimeoutSec 2 -ErrorAction Stop
        $backendReady = $true
        break
    } catch {
        if ($_.Exception.Response.StatusCode -eq 404 -or $_.Exception.Response.StatusCode -eq 401) {
            $backendReady = $true
            break
        }
    }
    Start-Sleep -Seconds 2
}

# Check frontend
for ($i = 0; $i -lt 15; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000" -Method GET -TimeoutSec 3 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $frontendReady = $true
            break
        }
    } catch {
        # Still starting
    }
    Start-Sleep -Seconds 3
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SERVER STATUS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($backendReady) {
    Write-Host "✓ Backend (Flask):  RUNNING on http://localhost:5000" -ForegroundColor Green
} else {
    Write-Host "✗ Backend (Flask):  NOT RESPONDING" -ForegroundColor Red
}

if ($frontendReady) {
    Write-Host "✓ Frontend (React): RUNNING on http://localhost:3000" -ForegroundColor Green
} else {
    Write-Host "Frontend (React): STILL STARTING (React takes 30-60 seconds)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host " Open your browser: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "To stop servers, press Ctrl+C or close this window" -ForegroundColor Yellow
Write-Host ""

# Keep script running
try {
    while ($true) {
        Start-Sleep -Seconds 10
    }
} finally {
    Stop-Job $backendJob, $frontendJob -ErrorAction SilentlyContinue
    Remove-Job $backendJob, $frontendJob -ErrorAction SilentlyContinue
}

