param(
    [switch]$Cleanup
)

$ErrorActionPreference = "Stop"
$Utf8Encoding = New-Object System.Text.UTF8Encoding $false
[Console]::OutputEncoding = $Utf8Encoding
$OutputEncoding = $Utf8Encoding
$ProjectRoot = Split-Path $PSScriptRoot -Parent
$ComposeProject = "mse-lot44-final"
$AdminPassword = "correct horse battery staple"
$PreviousTestProjects = @(
    "mse-lot42-test",
    "mse-lot42-final",
    "mse-lot43-test",
    "mse-lot43-final",
    "mse-lot43-manual",
    "mse-lot43-ui",
    "mse-lot43-api",
    "mse-lot43-corrections",
    "mse-lot43-migrations",
    "mse-lot44-auth-foundation",
    "mse-lot44-auth-api",
    "mse-lot44-auth-ui",
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
        $DockerCleanup = Start-Process -FilePath "docker" `
            -ArgumentList @("compose", "--project-name", $Project, "down", "--volumes", "--remove-orphans") `
            -NoNewWindow -Wait -PassThru
        if ($DockerCleanup.ExitCode -ne 0) {
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
    $env:POSTGRES_PORT = "55470"
    $env:API_HOST_PORT = "3601"
    $env:WEB_HOST_PORT = "3600"
    $env:POSTGRES_PASSWORD = "lot44-final-password"
    $env:ADMIN_AUTH_SECRET = "lot44-final-hmac-secret-at-least-32-characters"
    $env:ADMIN_SESSION_SECRET = "lot44-final-session-secret-at-least-32-characters"
    $env:ADMIN_WEB_ORIGIN = "http://127.0.0.1:3600"
    $env:ADMIN_COOKIE_SECURE = "false"
    $env:TRUST_PROXY = "false"
    $env:DATABASE_URL = "postgresql://mse:lot44-final-password@postgres:5432/motorsports_events"
    $env:VITE_API_URL = "http://127.0.0.1:3601"
    $env:API_URL = "http://127.0.0.1:3601"
    $env:WEB_URL = "http://127.0.0.1:3600"
    $env:ADMIN_PASSWORD = $AdminPassword

    Invoke-Checked { npm ci } "npm ci a échoué."
    Invoke-Checked { npm audit --audit-level=high } "npm audit a détecté un problème."
    Invoke-Checked { npm run lint } "Le lint a échoué."
    Invoke-Checked { npm run typecheck } "Le typecheck a échoué."
    Invoke-Checked { npm test } "Les tests unitaires ont échoué."
    Invoke-Checked { npm run build } "Le build a échoué."
    Invoke-Checked { docker compose up --build -d } "Le démarrage Docker a échoué."

    "correct horse battery staple" |
        docker compose run --rm -T api node apps/api/dist/cli/admin.js create --username admin --password-stdin
    if ($LASTEXITCODE -ne 0) { throw "La création de l'administrateur a échoué." }

    Invoke-Checked { npx playwright install chromium } "L'installation de Chromium a échoué."
    Invoke-Checked { npx playwright test tests/ui/auth.spec.ts --project=chromium } "La recette Chromium Auth a échoué."

    Write-Host ""
    Write-Host "Recette automatisée Lot 4.4 : OK" -ForegroundColor Green
    Write-Host "Interface : http://localhost:3600"
    Write-Host "API       : http://localhost:3601/health"
    Write-Host "Identifiant : admin"
    Write-Host "Mot de passe de test : correct horse battery staple"
    Write-Host "La pile reste active pour la validation humaine."
    Write-Host "Nettoyage : .\scripts\test-lot44-final.cmd -Cleanup"
} finally {
    Pop-Location
}
