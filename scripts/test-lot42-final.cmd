@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0.."
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\test-lot42-final.ps1 %*
exit /b %errorlevel%
