#requires -Version 7.0
$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'prepare.ps1')
& docker compose --project-name auction-platform-dev --file (Join-Path $PSScriptRoot 'compose.yaml') up -d --wait --wait-timeout 90
if ($LASTEXITCODE -ne 0) { throw 'Dedicated development infrastructure did not start.' }
function Get-LocalServicePort([string]$Service, [int]$ContainerPort) {
    $binding = & docker compose --project-name auction-platform-dev --file (Join-Path $PSScriptRoot 'compose.yaml') port $Service $ContainerPort
    if ($LASTEXITCODE -ne 0 -or $binding -notmatch '^127\.0\.0\.1:(\d+)$') {
        throw "Expected a loopback port binding for development service $Service."
    }
    return $Matches[1]
}
$dbPort = Get-LocalServicePort 'postgres' 5432
$mailPort = Get-LocalServicePort 'mailpit' 1025
$photoPath = (Join-Path $PSScriptRoot '.runtime/photos').Replace('\', '/')
# Non-secret connection metadata for both launchers. The password stays in db-password.
$settings = @(
    "DB_URL=jdbc:postgresql://127.0.0.1:$dbPort/auction"
    'DB_USER=auction'
    'MAIL_HOST=127.0.0.1'
    "MAIL_PORT=$mailPort"
    "PHOTO_ROOT=$photoPath"
)
[System.IO.File]::WriteAllLines((Join-Path $PSScriptRoot '.runtime/backend.properties'), $settings, [System.Text.UTF8Encoding]::new($false))
Write-Output 'PostgreSQL and Mailpit started. Use infra/stop.ps1 to stop this project while preserving data.'
