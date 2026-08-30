# Desktop Commander Edge Tray Companion — Transductive Science
Add-Type -AssemblyName System.Windows.Forms, System.Drawing

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$worktree = Split-Path -Parent $scriptDir
$publicUrl = "https://desktopcommander.transductive.art/mcp"
$dashUrl = "http://127.0.0.1:9180/dashboard"

# Create System Tray Icon
$notifyIcon = New-Object System.Windows.Forms.NotifyIcon
$notifyIcon.Text = "Desktop Commander Edge (Transductive Science)"
$notifyIcon.Visible = $true

# Extract system icon or create custom
$notifyIcon.Icon = [System.Drawing.SystemIcons]::Application

# Create Context Menu
$contextMenu = New-Object System.Windows.Forms.ContextMenuStrip

# 1. Open Dashboard
$itemDash = $contextMenu.Items.Add("⚡ Open Dashboard")
$itemDash.Font = New-Object System.Drawing.Font($itemDash.Font, [System.Drawing.FontStyle]::Bold)
$itemDash.Add_Click({
    Start-Process $dashUrl
})

# 2. Copy ChatGPT URL
$itemCopy = $contextMenu.Items.Add("📋 Copy ChatGPT Endpoint")
$itemCopy.Add_Click({
    [System.Windows.Forms.Clipboard]::SetText($publicUrl)
    $notifyIcon.ShowBalloonTip(2000, "Copied to Clipboard", $publicUrl, [System.Windows.Forms.ToolTipIcon]::Info)
})

# Separator
$contextMenu.Items.Add("-") | Out-Null

# 3. Restart Service
$itemRestart = $contextMenu.Items.Add("🔄 Restart Service")
$itemRestart.Add_Click({
    try {
        Stop-ScheduledTask -TaskName "DesktopCommanderMCP" -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
        Start-ScheduledTask -TaskName "DesktopCommanderMCP"
        $notifyIcon.ShowBalloonTip(2000, "Desktop Commander", "Service restarted successfully!", [System.Windows.Forms.ToolTipIcon]::Info)
    } catch {
        [System.Windows.Forms.MessageBox]::Show("Failed to restart service: $_", "Error", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
    }
})

# 4. View Logs
$itemLogs = $contextMenu.Items.Add("📄 View Logs")
$itemLogs.Add_Click({
    $logsPath = Join-Path $worktree "logs"
    if (Test-Path $logsPath) { Start-Process "explorer.exe" $logsPath }
})

# 5. Transductive Science
$itemTrans = $contextMenu.Items.Add("🌐 Transductive Science (transductive.org)")
$itemTrans.Add_Click({
    Start-Process "https://transductive.org"
})

# Separator
$contextMenu.Items.Add("-") | Out-Null

# 6. Exit
$itemExit = $contextMenu.Items.Add("❌ Exit Tray Companion")
$itemExit.Add_Click({
    $notifyIcon.Visible = $false
    $notifyIcon.Dispose()
    [System.Windows.Forms.Application]::Exit()
})

$notifyIcon.ContextMenuStrip = $contextMenu

# Double-click opens dashboard
$notifyIcon.Add_DoubleClick({
    Start-Process $dashUrl
})

# Show initial balloon tip
$notifyIcon.ShowBalloonTip(3000, "Desktop Commander Edge Active", "Running on port 9180. Double-click tray icon to open Dashboard.", [System.Windows.Forms.ToolTipIcon]::Info)

# Run Application Loop
[System.Windows.Forms.Application]::Run()
