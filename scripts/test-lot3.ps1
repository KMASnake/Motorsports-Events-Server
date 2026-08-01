$ErrorActionPreference = "Stop"

try {
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
}
catch {
    # L'encodage par défaut reste utilisable si la console ne permet pas ce réglage.
}

$root = Split-Path $PSScriptRoot -Parent
Push-Location $root

try {
    Write-Host "=== Docker Compose ===" -ForegroundColor Cyan
    docker compose ps

    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose indisponible."
    }

    node scripts/validate-lot3.mjs

    if ($LASTEXITCODE -ne 0) {
        throw "Validation du lot 3 échouée."
    }
}
finally {
    Pop-Location
}
