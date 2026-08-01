param(
    [switch]$KeepVolumes,
    [switch]$KeepImages
)

$ErrorActionPreference = "Stop"

try {
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
}
catch {
    # La console conserve son encodage par défaut si ce réglage est indisponible.
}

$ProjectRoot = Split-Path $PSScriptRoot -Parent
Push-Location $ProjectRoot

try {
    $cleanupArgs = @("-Force")

    if (-not $KeepVolumes) {
        $cleanupArgs += "-Volumes"
    }

    if (-not $KeepImages) {
        $cleanupArgs += "-Images"
    }

    & "$PSScriptRoot\cleanup.ps1" @cleanupArgs

    if (-not (Test-Path ".env")) {
        Copy-Item ".env.example" ".env"
        Write-Host ".env créé depuis .env.example." -ForegroundColor Green
    }

    docker compose up --build -d

    if ($LASTEXITCODE -ne 0) {
        throw "Échec de docker compose up --build -d."
    }

    Write-Host "Attente des healthchecks..." -ForegroundColor Cyan

    $deadline = (Get-Date).AddMinutes(3)

    do {
        Start-Sleep -Seconds 3

        $rawStatuses = docker compose ps --format json

        if ($LASTEXITCODE -ne 0) {
            throw "Impossible de lire l'état Docker Compose."
        }

        $statuses = @()

        foreach ($line in $rawStatuses) {
            if ($line) {
                $statuses += ($line | ConvertFrom-Json)
            }
        }

        $starting = @(
            $statuses |
            Where-Object { $_.Health -eq "starting" }
        )

        $unhealthy = @(
            $statuses |
            Where-Object {
                $_.Health -and $_.Health -notin @("healthy", "starting")
            }
        )
    }
    while (
        ($starting.Count -gt 0 -or $unhealthy.Count -gt 0) -and
        (Get-Date) -lt $deadline
    )

    docker compose ps

    if ($unhealthy.Count -gt 0) {
        throw "Un ou plusieurs conteneurs sont en erreur de healthcheck."
    }

    npm run validate:lot4

    if ($LASTEXITCODE -ne 0) {
        throw "La validation automatique du lot 4 a échoué."
    }
}
finally {
    Pop-Location
}
