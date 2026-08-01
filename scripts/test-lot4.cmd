@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0.."
node scripts\validate-lot4.mjs
if errorlevel 1 exit /b 1
echo.
echo Validation Lot 4 terminee.
