@echo off
setlocal
cd /d "%~dp0.."
docker compose down -v --remove-orphans
if not exist .env copy /Y .env.example .env >nul
docker compose up --build
endlocal
