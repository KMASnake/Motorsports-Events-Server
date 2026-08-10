param(
    [switch]$Cleanup
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path $PSScriptRoot -Parent
$ComposeProject = "mse-lot42-final"

function Invoke-Checked {
    param([scriptblock]$Command, [string]$Failure)
    & $Command
    if ($LASTEXITCODE -ne 0) { throw $Failure }
}

Push-Location $ProjectRoot
try {
    $env:COMPOSE_PROJECT_NAME = $ComposeProject
    $env:POSTGRES_PORT = "55436"
    $env:API_HOST_PORT = "3601"
    $env:WEB_HOST_PORT = "3600"
    $env:POSTGRES_PASSWORD = "lot42-final-password"
    $env:ADMIN_AUTH_SECRET = "lot42-final-admin-secret-at-least-32-characters"
    $env:DATABASE_URL = "postgresql://mse:lot42-final-password@postgres:5432/motorsports_events"
    $env:VITE_API_URL = "http://localhost:3601"
    $env:API_URL = "http://127.0.0.1:3601"
    $env:WEB_URL = "http://127.0.0.1:3600"

    if ($Cleanup) {
        docker compose down --volumes --remove-orphans
        if ($LASTEXITCODE -ne 0) { throw "Le nettoyage Docker a échoué." }
        Write-Host "Environnement Lot 4.2 supprimé."
        exit 0
    }

    foreach ($Tool in @("node", "npm", "docker")) {
        if (-not (Get-Command $Tool -ErrorAction SilentlyContinue)) {
            throw "Outil requis absent : $Tool"
        }
    }

    $NodeMajor = [int]((node --version).TrimStart("v").Split(".")[0])
    $NpmMajor = [int]((npm --version).Split(".")[0])
    if ($NodeMajor -lt 22) { throw "Node.js 22 minimum est requis." }
    if ($NpmMajor -lt 10) { throw "npm 10 minimum est requis." }

    Invoke-Checked { npm ci } "npm ci a échoué."
    Invoke-Checked { npm audit --audit-level=high } "npm audit a détecté un problème."
    Invoke-Checked { npm run typecheck } "Le typecheck a échoué."
    Invoke-Checked { npm run lint } "Le lint a échoué."
    Invoke-Checked { npm test } "Les tests unitaires ont échoué."
    Invoke-Checked { npm run build } "Le build a échoué."

    docker compose down --volumes --remove-orphans 2>$null
    Invoke-Checked { docker compose up --build -d } "Le démarrage Docker a échoué."

    $env:ADMIN_TOKEN_LIFETIME_SECONDS = "14400"
    $env:ADMIN_TOKEN = (node scripts/generate-admin-token.mjs).Trim()
    if (-not $env:ADMIN_TOKEN) { throw "La génération du jeton administrateur a échoué." }
    Set-Clipboard -Value $env:ADMIN_TOKEN

    $env:DATABASE_URL = "postgresql://mse:lot42-final-password@127.0.0.1:55436/motorsports_events"
    Invoke-Checked { npm run data:generate -- --seed=windows-final-acceptance } "La génération des données a échoué."
    Invoke-Checked { & scripts/data/verify-sanitized-data.ps1 -Database motorsports_events -ComposeProject $ComposeProject } "La vérification des données synthétiques a échoué."
    Invoke-Checked { npm run validate:lot4 } "Le validateur Lot 4 a échoué."
    Invoke-Checked { npm run validate:step2 } "Le validateur Étape 2 a échoué."
    Invoke-Checked { npm run validate:step3 } "Le validateur Étape 3 a échoué."
    Invoke-Checked { npx playwright install chromium } "L'installation de Chromium a échoué."
    Invoke-Checked { npx playwright test } "La recette Chromium a échoué."

    Write-Host ""
    Write-Host "Recette automatisée Lot 4.2 : OK" -ForegroundColor Green
    Write-Host "Interface : http://localhost:3600"
    Write-Host "API       : http://localhost:3601/health"
    Write-Host "Le jeton administrateur temporaire a été copié dans le presse-papiers."
    Write-Host "La pile reste active pour la validation humaine."
    Write-Host "Nettoyage : .\scripts\test-lot42-final.ps1 -Cleanup"
} finally {
    Pop-Location
}
