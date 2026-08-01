$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path $PSScriptRoot -Parent
Push-Location $ProjectRoot
try {
docker compose down -v --remove-orphans
    Copy-Item .env.example .env -Force
    docker compose up --build
}
finally {
    Pop-Location
}
