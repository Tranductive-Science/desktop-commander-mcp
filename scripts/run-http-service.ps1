# Persistent runner for Desktop Commander HTTP MCP Server
$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$worktree = Split-Path -Parent $scriptDir
$logsDir = Join-Path $worktree 'logs'
if (-not (Test-Path $logsDir)) {
    New-Item -ItemType Directory -Force -Path $logsDir | Out-Null
}

$pidFile = Join-Path $logsDir 'http-service.pid'
$mgrLog = Join-Path $logsDir 'http-service.manager.log'

$existing = Get-NetTCPConnection -LocalPort 9180 -State Listen -ErrorAction SilentlyContinue
if ($existing) {
    "[$(Get-Date -Format 'o')] Already listening on port 9180 (PID $($existing.OwningProcess))" | Out-File -FilePath $mgrLog -Append -Encoding utf8
    exit 0
}

$nodeExe = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
if (-not $nodeExe) { $nodeExe = 'C:\Program Files\nodejs\node.exe' }
$serverScript = Join-Path $worktree 'scripts\start-http-server.js'

$pinfo = New-Object System.Diagnostics.ProcessStartInfo
$pinfo.FileName = $nodeExe
$pinfo.Arguments = "`"$serverScript`""
$pinfo.WorkingDirectory = $worktree
$pinfo.UseShellExecute = $false
$pinfo.CreateNoWindow = $true

$proc = [System.Diagnostics.Process]::Start($pinfo)
if ($proc) {
    [IO.File]::WriteAllText($pidFile, [string]$proc.Id)
    "[$(Get-Date -Format 'o')] Started Desktop Commander HTTP process with PID $($proc.Id)" | Out-File -FilePath $mgrLog -Append -Encoding utf8
}
