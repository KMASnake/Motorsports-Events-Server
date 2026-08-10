@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0reset-from-production-snapshot.ps1" %*
