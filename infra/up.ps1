#requires -Version 7.0
$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'prepare.ps1')
& docker compose --project-name auction-platform-dev --file (Join-Path $PSScriptRoot 'compose.yaml') up -d --wait --wait-timeout 90
if ($LASTEXITCODE -ne 0) { throw 'Dedicated development infrastructure did not start.' }
Write-Output 'PostgreSQL and Mailpit started. Use infra/stop.ps1 to stop this project while preserving data.'
