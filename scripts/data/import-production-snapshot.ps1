param([Parameter(Mandatory=$true)][string]$DumpFile,[string]$ComposeProject="mse-snapshot-sanitize")
$ErrorActionPreference="Stop"
if ($env:NODE_ENV -eq "production") { throw "Import refusé avec NODE_ENV=production." }
if (-not (Test-Path $DumpFile)) { throw "Dump introuvable." }
if ($env:DATABASE_URL -match 'motorsports-events\.fr|production|prod-db') { throw "Hôte de production refusé." }
$answer=Read-Host "Saisir SANITIZE pour restaurer dans une base temporaire isolée"
if($answer -ne "SANITIZE"){throw "Import annulé."}
$root=Resolve-Path (Join-Path $PSScriptRoot "../..")
$temporaryDb="mse_sanitize_$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
try {
  docker compose -p $ComposeProject up -d postgres
  docker compose -p $ComposeProject exec -T postgres createdb -U mse $temporaryDb
  Get-Content -Raw $DumpFile | docker compose -p $ComposeProject exec -T postgres pg_restore -U mse -d $temporaryDb --no-owner --no-acl
  Get-Content -Raw (Join-Path $PSScriptRoot "sanitize-test-data.sql") | docker compose -p $ComposeProject exec -T postgres psql -U mse -d $temporaryDb -v ON_ERROR_STOP=1
  & (Join-Path $PSScriptRoot "verify-sanitized-data.ps1") -Database $temporaryDb -ComposeProject $ComposeProject
  if($LASTEXITCODE -ne 0){throw "Vérification bloquante échouée."}
  Write-Host "Base temporaire assainie et vérifiée : $temporaryDb"
} catch {
  docker compose -p $ComposeProject exec -T postgres dropdb -U mse --if-exists $temporaryDb | Out-Null
  throw
}
