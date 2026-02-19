# NextGen Data Architects - Start All Services
# Opens separate CMD windows for each service

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "NextGen Data Architects - Starting All Services" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendPath = Join-Path $scriptPath "backend"
$frontendPath = Join-Path $scriptPath "frontend"

# Start Backend Server
Write-Host "[1/2] Starting Backend Server..." -ForegroundColor Green
Start-Process cmd -ArgumentList "/k", "cd /d `"$backendPath`" && python start_server.py" -WindowStyle Normal

Start-Sleep -Seconds 3

# Start Frontend Server
Write-Host "[2/2] Starting Frontend Server..." -ForegroundColor Green
Start-Process cmd -ArgumentList "/k", "cd /d `"$frontendPath`" && npm start" -WindowStyle Normal

Write-Host ""
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "All services are starting in separate windows" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend:  http://localhost:5000" -ForegroundColor Yellow
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Yellow
Write-Host ""
Write-Host "Close the windows to stop the services" -ForegroundColor Green
Write-Host "================================================================================" -ForegroundColor Cyan

