#requires -Version 7.0
$ErrorActionPreference = 'Stop'
& docker compose --project-name auction-platform-dev --file (Join-Path $PSScriptRoot 'compose.yaml') stop
if ($LASTEXITCODE -ne 0) { throw 'Development infrastructure stop failed.' }
Write-Output 'Development services stopped; volumes and the local secret were preserved.'
