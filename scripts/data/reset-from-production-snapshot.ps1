param([Parameter(Mandatory=$true)][string]$DumpFile)
& (Join-Path $PSScriptRoot "import-production-snapshot.ps1") -DumpFile $DumpFile
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
