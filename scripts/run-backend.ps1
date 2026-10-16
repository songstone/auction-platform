#requires -Version 7.0
param(
    [string]$JavaHome = $env:AUCTION_JAVA_HOME,
    [switch]$WithInfrastructure
)
$ErrorActionPreference = 'Stop'
$repoPath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if (!$JavaHome) { $JavaHome = $env:JAVA_HOME }
if (!$JavaHome) { throw 'Pass -JavaHome or set AUCTION_JAVA_HOME to a JDK 25 directory.' }
$javaExe = Join-Path $JavaHome 'bin/java.exe'
if (!(Test-Path -LiteralPath $javaExe)) { throw 'JDK java.exe not found.' }
$javaVersion = (& $javaExe -version 2>&1 | Out-String)
if ($javaVersion -notmatch 'version "25(?:\.|\")') { throw 'JDK 25 is required.' }
$jarPath = Join-Path $repoPath 'backend/build/libs/auction-platform-backend-0.1.0-SNAPSHOT.jar'
if (!(Test-Path -LiteralPath $jarPath)) { throw 'Build the backend first with scripts/verify.ps1 or backend/gradlew.bat clean build.' }
$environmentNames = @('SPRING_PROFILES_ACTIVE', 'DB_URL', 'DB_USER', 'DB_PASSWORD', 'MAIL_HOST', 'MAIL_PORT', 'PHOTO_ROOT')
$originalEnvironment = @{}
foreach ($name in $environmentNames) { $originalEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
try {
    if ($WithInfrastructure) {
        $env:SPRING_PROFILES_ACTIVE = 'local-infra'
        if (!$env:DB_PASSWORD) {
            $secretPath = Join-Path $repoPath 'infra/.runtime/db-password'
            if (!(Test-Path -LiteralPath $secretPath)) { throw 'Run infra/up.ps1 first, or provide DB_PASSWORD in the process environment.' }
            $env:DB_PASSWORD = [System.IO.File]::ReadAllText($secretPath).Trim()
        }
        if (!$env:MAIL_HOST) { $env:MAIL_HOST = '127.0.0.1' }
        if (!$env:MAIL_PORT) { $env:MAIL_PORT = '51025' }
        if (!$env:PHOTO_ROOT) { $env:PHOTO_ROOT = Join-Path $repoPath 'infra/.runtime/photos' }
    }
    & $javaExe -jar $jarPath
    if ($LASTEXITCODE -ne 0) { throw 'Backend process exited unsuccessfully; inspect its startup log.' }
} finally {
    foreach ($name in $environmentNames) { [Environment]::SetEnvironmentVariable($name, $originalEnvironment[$name], 'Process') }
}
