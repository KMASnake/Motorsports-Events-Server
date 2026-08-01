$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path $PSScriptRoot -Parent
Push-Location $ProjectRoot
try { node scripts/validate-lot4.mjs; if ($LASTEXITCODE -ne 0) { throw "La validation du lot 4 a échoué." } } finally { Pop-Location }
