param([string]$JavaHome = 'C:\Users\jitin81\.jdks\corretto-25.0.3')
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$runtime = Join-Path $PSScriptRoot '.runtime'
New-Item -ItemType Directory -Force -Path $runtime | Out-Null
$credentialPath = Join-Path $runtime 'db.json'
if (!(Test-Path -LiteralPath $credentialPath)) {
    $randomBytes = [byte[]]::new(32)
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($randomBytes)
    @{ password = [Convert]::ToBase64String($randomBytes) } | ConvertTo-Json | Set-Content -LiteralPath $credentialPath -Encoding utf8
}
$dbCredential = Get-Content -LiteralPath $credentialPath -Raw | ConvertFrom-Json
$env:POSTGRES_PASSWORD = $dbCredential.password
$existing = docker ps -a --filter 'name=^/auction-spike-001-db$' --format '{{.Names}}'
if (!$existing) {
    docker run -d --name auction-spike-001-db --label purpose=auction-spike-001 --cpus=2 --memory=1g -p 127.0.0.1:15432:5432 -e POSTGRES_PASSWORD -e POSTGRES_USER=spike -e POSTGRES_DB=spike001 postgres:18.6-alpine -c max_connections=100 -c track_commit_timestamp=on | Out-Null
    if($LASTEXITCODE -ne 0){throw 'Dedicated PostgreSQL container creation failed'}
} else {
    docker start auction-spike-001-db | Out-Null
}
Remove-Item Env:POSTGRES_PASSWORD
for($attempt=0;$attempt -lt 30;$attempt++) {
    docker exec auction-spike-001-db pg_isready -U spike -d spike001 *> $null
    if($LASTEXITCODE -eq 0){break}
    Start-Sleep -Milliseconds 500
}
if($LASTEXITCODE -ne 0){throw 'PostgreSQL did not become ready'}
$env:JAVA_HOME = $JavaHome
& (Join-Path $JavaHome 'bin/java.exe') --version
if($LASTEXITCODE -ne 0){throw 'Java 25 runtime is required'}
if(!(Test-Path -LiteralPath (Join-Path $PSScriptRoot 'mvnw.cmd'))){throw 'Use the checked-in Maven wrapper'}
Write-Output 'Dedicated PostgreSQL ready; credentials kept in ignored .runtime/db.json.'
