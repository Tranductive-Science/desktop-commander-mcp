# One-Click Installer for Desktop Commander Edge — Transductive Science
# Run: powershell -ExecutionPolicy Bypass -File Install-DesktopCommander-Edge.ps1

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Desktop Commander Edge Edition — Installer" -ForegroundColor White
Write-Host "  By Transductive Science (https://transductive.org)" -ForegroundColor Magenta
Write-Host "==========================================================`n" -ForegroundColor Cyan

# 1. Check Node.js
Write-Host "[1/6] Checking Node.js runtime..." -ForegroundColor Yellow
$nodeExe = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
if (-not $nodeExe) {
    Write-Host "Node.js not found. Please install Node.js (>= 18) from https://nodejs.org" -ForegroundColor Red
    exit 1
}
$nodeVer = & $nodeExe -v
Write-Host "  Found Node.js: $nodeVer at $nodeExe" -ForegroundColor Green

# 2. Check & Install Ripgrep
Write-Host "`n[2/6] Checking ripgrep binary..." -ForegroundColor Yellow
$rgExe = (Get-Command rg.exe -ErrorAction SilentlyContinue).Source
if (-not $rgExe -and (Test-Path "C:\Program Files\Ripgrep\rg.exe")) {
    $rgExe = "C:\Program Files\Ripgrep\rg.exe"
}
if ($rgExe) {
    Write-Host "  Found ripgrep: $rgExe" -ForegroundColor Green
} else {
    Write-Host "  Installing ripgrep via WinGet..." -ForegroundColor Gray
    try {
        winget install BurntSushi.ripgrep.MSVC --accept-package-agreements --accept-source-agreements --silent
        Write-Host "  Ripgrep installed successfully!" -ForegroundColor Green
    } catch {
        Write-Host "  Could not auto-install ripgrep via winget. Standard searches will use built-in fallback." -ForegroundColor Yellow
    }
}

# 3. Build Desktop Commander Runtime
Write-Host "`n[3/6] Building Desktop Commander runtime..." -ForegroundColor Yellow
npm run build
Write-Host "  Build completed successfully!" -ForegroundColor Green

# 4. Check Cloudflare Tunnel
Write-Host "`n[4/6] Checking Cloudflare Tunnel connectivity..." -ForegroundColor Yellow
$cloudflared = (Get-Command cloudflared.exe -ErrorAction SilentlyContinue).Source
if ($cloudflared) {
    Write-Host "  Found Cloudflare Tunnel CLI: $cloudflared" -ForegroundColor Green
} else {
    Write-Host "  Note: Cloudflare Tunnel (cloudflared) can be installed via 'winget install Cloudflare.cloudflared'." -ForegroundColor Gray
}

# 5. Register Auto-Starting Windows Service
Write-Host "`n[5/6] Registering persistent Windows background task..." -ForegroundColor Yellow
$taskName = "DesktopCommanderMCP"
$action = New-ScheduledTaskAction -Execute $nodeExe -Argument "`"$scriptDir\scripts\start-http-server.js`"" -WorkingDirectory $scriptDir
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1)

try {
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
    Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    Start-ScheduledTask -TaskName $taskName
    Write-Host "  Windows service registered & started successfully!" -ForegroundColor Green
} catch {
    Write-Host "  Warning: Run as Administrator to register startup task: $_" -ForegroundColor Yellow
}

# 6. Create Desktop & Start Menu Shortcuts
Write-Host "`n[6/6] Creating Desktop Companion Shortcuts..." -ForegroundColor Yellow
$wsh = New-Object -ComObject WScript.Shell
$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcut = $wsh.CreateShortcut("$desktopPath\Desktop Commander Companion.lnk")
$shortcut.TargetPath = "powershell.exe"
$shortcut.Arguments = "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptDir\scripts\tray-companion.ps1`""
$shortcut.WorkingDirectory = $scriptDir
$shortcut.Description = "Desktop Commander Edge Tray Companion"
$shortcut.Save()
Write-Host "  Created shortcut on Desktop: 'Desktop Commander Companion'" -ForegroundColor Green

# Launch Tray & Open Dashboard
Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "  Installation Complete! Launching Companion..." -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Green

Start-Process "powershell.exe" -ArgumentList "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptDir\scripts\tray-companion.ps1`""
Start-Sleep -Seconds 2
Start-Process "http://127.0.0.1:9180/dashboard"
