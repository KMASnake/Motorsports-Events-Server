@echo off
setlocal
cd /d "%~dp0.."
node scripts\validate-lot2.mjs
endlocal
