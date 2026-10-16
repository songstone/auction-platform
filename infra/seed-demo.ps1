#requires -Version 7.0
$ErrorActionPreference = 'Stop'
# Deliberately target only this project's local Compose service; no external DB arguments.
$composeFile = Join-Path $PSScriptRoot '../backend/compose.yaml'
$seedPath = Join-Path $PSScriptRoot 'fixtures/public-rounds.sql'
Get-Content -LiteralPath $seedPath -Raw |
    docker compose --project-name auction-platform-dev --file $composeFile exec -T postgres `
        psql -U auction -d auction -v ON_ERROR_STOP=1
if ($LASTEXITCODE -ne 0) { throw 'Demo seeding failed. Start the backend with the local-infra profile once to apply migrations.' }
Write-Output 'Synthetic local rows prepared; existing rows were preserved. Open http://127.0.0.1:5173/?roundId=demo-round'
