param(
    [switch]$Cleanup
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path $PSScriptRoot -Parent
$ComposeProject = "mse-lot43-final"
$PreviousTestProjects = @(
    "mse-lot42-final",
    "mse-lot43-manual",
    "mse-lot43-ui",
    "mse-lot43-api",
    "mse-lot43-corrections",
    "mse-lot43-migrations",
    $ComposeProject
) | Select-Object -Unique

function Invoke-Checked {
    param([scriptblock]$Command, [string]$Failure)
    & $Command
    if ($LASTEXITCODE -ne 0) { throw $Failure }
}

function Remove-TestProjects {
    foreach ($Project in $PreviousTestProjects) {
        Write-Host "Nettoyage de la pile de test $Project..."
        docker compose --project-name $Project down --volumes --remove-orphans 2>$null
        if ($LASTEXITCODE -ne 0) {
            throw "Le nettoyage Docker de $Project a échoué."
        }
    }
}

Push-Location $ProjectRoot
try {
    foreach ($Tool in @("node", "npm", "docker")) {
        if (-not (Get-Command $Tool -ErrorAction SilentlyContinue)) {
            throw "Outil requis absent : $Tool"
        }
    }

    Remove-TestProjects
    if ($Cleanup) {
        Write-Host "Toutes les piles Docker de recette MEDS connues ont été supprimées." -ForegroundColor Green
        exit 0
    }

    $NodeMajor = [int]((node --version).TrimStart("v").Split(".")[0])
    $NpmMajor = [int]((npm --version).Split(".")[0])
    if ($NodeMajor -lt 22) { throw "Node.js 22 minimum est requis." }
    if ($NpmMajor -lt 10) { throw "npm 10 minimum est requis." }

    $env:COMPOSE_PROJECT_NAME = $ComposeProject
    $env:POSTGRES_PORT = "55437"
    $env:API_HOST_PORT = "3611"
    $env:WEB_HOST_PORT = "3610"
    $env:POSTGRES_PASSWORD = "lot43-final-password"
    $env:ADMIN_AUTH_SECRET = "lot43-final-admin-secret-at-least-32-characters"
    $env:DATABASE_URL = "postgresql://mse:lot43-final-password@postgres:5432/motorsports_events"
    $env:VITE_API_URL = "http://localhost:3611"
    $env:API_URL = "http://127.0.0.1:3611"
    $env:WEB_URL = "http://127.0.0.1:3610"

    Invoke-Checked { npm ci } "npm ci a échoué."
    Invoke-Checked { npm audit --audit-level=high } "npm audit a détecté un problème."
    Invoke-Checked { npm run lint } "Le lint a échoué."
    Invoke-Checked { npm run typecheck } "Le typecheck a échoué."
    Invoke-Checked { npm test } "Les tests unitaires ont échoué."
    Invoke-Checked { npm run build } "Le build a échoué."
    Invoke-Checked { docker compose up --build -d } "Le démarrage Docker a échoué."

    $env:ADMIN_TOKEN_LIFETIME_SECONDS = "14400"
    $env:ADMIN_ROLE = "admin"
    $env:ADMIN_SUBJECT = "lot43-windows-final"
    $env:ADMIN_TOKEN = (node scripts/generate-admin-token.mjs).Trim()
    if (-not $env:ADMIN_TOKEN) { throw "La génération du jeton administrateur a échoué." }
    Set-Clipboard -Value $env:ADMIN_TOKEN

    $env:DATABASE_URL = "postgresql://mse:lot43-final-password@127.0.0.1:55437/motorsports_events"
    Invoke-Checked { npm run data:generate -- --seed=windows-lot43-final } "La génération des données a échoué."
    Get-Content -Raw tests/fixtures/lot43_ui.sql |
        docker compose exec -T postgres psql -U mse -d motorsports_events
    if ($LASTEXITCODE -ne 0) { throw "L'injection de la fixture Lot 4.3 a échoué." }

    Invoke-Checked { & scripts/data/verify-sanitized-data.ps1 -Database motorsports_events -ComposeProject $ComposeProject } "La vérification des données synthétiques a échoué."
    Invoke-Checked { npm run validate:lot4 } "Le validateur Lot 4 a échoué."
    Invoke-Checked { npm run validate:step2 } "Le validateur Étape 2 a échoué."
    Invoke-Checked { npm run validate:step3 } "Le validateur Étape 3 a échoué."
    Invoke-Checked { npx playwright install chromium } "L'installation de Chromium a échoué."
    Invoke-Checked { npx playwright test } "La recette Chromium a échoué."

    Write-Host ""
    Write-Host "Recette automatisée Lot 4.3 : OK" -ForegroundColor Green
    Write-Host "Interface : http://localhost:3610"
    Write-Host "API       : http://localhost:3611/health"
    Write-Host "Le jeton administrateur temporaire a été copié dans le presse-papiers."
    Write-Host "La pile reste active pour la validation humaine."
    Write-Host "Nettoyage : .\scripts\test-lot43-final.cmd -Cleanup"
} finally {
    Pop-Location
}
