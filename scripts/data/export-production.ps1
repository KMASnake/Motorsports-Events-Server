param([string]$OutputDirectory = "snapshots")
$ErrorActionPreference = "Stop"
if (-not $env:PRODUCTION_DATABASE_URL) { throw "PRODUCTION_DATABASE_URL doit être fourni explicitement." }
Write-Warning "Export en lecture seule d'une base sensible. Le dump ne doit jamais être commité."
$answer = Read-Host "Saisir EXPORT pour continuer"
if ($answer -ne "EXPORT") { throw "Export annulé." }
New-Item -ItemType Directory -Force $OutputDirectory | Out-Null
$stamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHHmmssZ")
$file = Join-Path $OutputDirectory "motorsports-events-prod-$stamp.dump"
pg_dump --format=custom --no-owner --no-acl --dbname=$env:PRODUCTION_DATABASE_URL --file=$file
if ($LASTEXITCODE -ne 0) { throw "pg_dump a échoué." }
Get-FileHash -Algorithm SHA256 $file | Format-List
Write-Host "Dump créé hors Git : $file"
