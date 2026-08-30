@echo off
title Desktop Commander Edge Installer
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-DesktopCommander-Edge.ps1"
pause
