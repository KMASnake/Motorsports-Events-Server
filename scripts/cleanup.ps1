param(
    [switch]$Volumes,
    [switch]$Images,
    [switch]$Force
)

$ErrorActionPreference = "Stop"
$ProjectPattern = "motorsports-events"

function Write-Step([string]$Message) {
    Write-Host "`n=== $Message ===" -ForegroundColor Cyan
}

function Confirm-Action([string]$Message) {
    if ($Force) {
        return $true
    }

    $answer = Read-Host "$Message [o/N]"
    return $answer -match '^(o|oui|y|yes)$'
}

function Get-DockerDiskUsage {
    try {
        return (docker system df 2>$null | Out-String).Trim()
    }
    catch {
        return "Indisponible"
    }
}

Write-Host "Nettoyage Docker Motorsports Events" -ForegroundColor Yellow
$before = Get-DockerDiskUsage

Write-Step "Conteneurs"
$containers = @(
    docker ps -aq --filter "name=$ProjectPattern" 2>$null |
    Where-Object { $_ -and $_.Trim() }
)

if ($containers.Count -gt 0) {
    docker rm -f $containers
    Write-Host "$($containers.Count) conteneur(s) supprimé(s)." -ForegroundColor Green
}
else {
    Write-Host "Aucun conteneur correspondant."
}

Write-Step "Réseaux"
$networks = @(
    docker network ls --format "{{.Name}}" 2>$null |
    Where-Object { $_ -like "*$ProjectPattern*" }
)

foreach ($network in $networks) {
    try {
        docker network rm $network | Out-Null
        Write-Host "Réseau supprimé : $network" -ForegroundColor Green
    }
    catch {
        Write-Warning "Impossible de supprimer le réseau $network : $($_.Exception.Message)"
    }
}

if ($networks.Count -eq 0) {
    Write-Host "Aucun réseau correspondant."
}

$removeVolumes = $Volumes -or (
    Confirm-Action "Supprimer aussi les volumes de données du projet ? Cette action efface les bases PostgreSQL de test."
)

if ($removeVolumes) {
    Write-Step "Volumes"

    $volumesList = @(
        docker volume ls --format "{{.Name}}" 2>$null |
        Where-Object { $_ -like "*$ProjectPattern*" }
    )

    foreach ($volume in $volumesList) {
        try {
            docker volume rm $volume | Out-Null
            Write-Host "Volume supprimé : $volume" -ForegroundColor Green
        }
        catch {
            Write-Warning "Impossible de supprimer le volume $volume : $($_.Exception.Message)"
        }
    }

    if ($volumesList.Count -eq 0) {
        Write-Host "Aucun volume correspondant."
    }
}
else {
    Write-Host "`nVolumes conservés."
}

$removeImages = $Images -or (
    Confirm-Action "Supprimer aussi les images Docker des anciennes versions Motorsports Events ?"
)

if ($removeImages) {
    Write-Step "Images"

    $imageIds = @(
        docker image ls --format "{{.Repository}} {{.ID}}" 2>$null |
        Where-Object { $_ -like "*$ProjectPattern*" } |
        ForEach-Object { ($_ -split '\s+')[-1] } |
        Sort-Object -Unique
    )

    foreach ($imageId in $imageIds) {
        try {
            docker image rm -f $imageId | Out-Null
            Write-Host "Image supprimée : $imageId" -ForegroundColor Green
        }
        catch {
            Write-Warning "Impossible de supprimer l'image $imageId : $($_.Exception.Message)"
        }
    }

    if ($imageIds.Count -eq 0) {
        Write-Host "Aucune image correspondante."
    }
}
else {
    Write-Host "`nImages conservées."
}

Write-Step "Résumé"
Write-Host "Avant :" -ForegroundColor DarkCyan
Write-Host $before
Write-Host "`nAprès :" -ForegroundColor DarkCyan
Write-Host (Get-DockerDiskUsage)
Write-Host "`nNettoyage terminé." -ForegroundColor Green
