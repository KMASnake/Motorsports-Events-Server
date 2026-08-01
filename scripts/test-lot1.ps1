$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path $PSScriptRoot -Parent
Push-Location $ProjectRoot
try {

    Write-Host "=== Docker Compose ===" -ForegroundColor Cyan
    docker compose ps

    Write-Host "`n=== API health ===" -ForegroundColor Cyan
    $health = Invoke-RestMethod http://localhost:3001/health
    $health | Format-List

    if ($health.status -ne "ok") {
        throw "L'API ne retourne pas status=ok."
    }

    Write-Host "`n=== Dashboard summary ===" -ForegroundColor Cyan
    Invoke-RestMethod http://localhost:3001/api/v1/dashboard/summary | Format-List

    Write-Host "`n=== Vérification frontend ===" -ForegroundColor Cyan
    $response = Invoke-WebRequest http://localhost:3000 -UseBasicParsing
    if ($response.StatusCode -ne 200) {
        throw "Le frontend ne retourne pas HTTP 200."
    }

    Write-Host "`nLot 1 techniquement accessible. Vérifie visuellement les quatre pages de référence." -ForegroundColor Green
}
finally {
    Pop-Location
}
