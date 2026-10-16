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
$environmentNames = @('SPRING_PROFILES_ACTIVE', 'DB_URL', 'DB_USER', 'DB_PASSWORD', 'MAIL_HOST', 'MAIL_PORT', 'PHOTO_ROOT',
    'SPRING_DATASOURCE_URL', 'SPRING_DATASOURCE_USERNAME', 'SPRING_DATASOURCE_PASSWORD',
    'SPRING_FLYWAY_URL', 'SPRING_FLYWAY_USER', 'SPRING_FLYWAY_PASSWORD')
$originalEnvironment = @{}
foreach ($name in $environmentNames) { $originalEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
try {
    if ($WithInfrastructure) {
        & (Join-Path $repoPath 'infra/up.ps1')
        $env:SPRING_PROFILES_ACTIVE = 'local-infra'
        foreach ($line in [System.IO.File]::ReadAllLines((Join-Path $repoPath 'infra/.runtime/backend.properties'))) {
            $name, $value = $line.Split('=', 2)
            [Environment]::SetEnvironmentVariable($name, $value, 'Process')
        }
        $env:DB_PASSWORD = [System.IO.File]::ReadAllText((Join-Path $repoPath 'infra/.runtime/db-password')).Trim()
        $env:SPRING_DATASOURCE_URL = $env:DB_URL
        $env:SPRING_DATASOURCE_USERNAME = $env:DB_USER
        $env:SPRING_DATASOURCE_PASSWORD = $env:DB_PASSWORD
        $env:SPRING_FLYWAY_URL = $env:DB_URL
        $env:SPRING_FLYWAY_USER = $env:DB_USER
        $env:SPRING_FLYWAY_PASSWORD = $env:DB_PASSWORD
    }
    & $javaExe -jar $jarPath
    if ($LASTEXITCODE -ne 0) { throw 'Backend process exited unsuccessfully; inspect its startup log.' }
} finally {
    foreach ($name in $environmentNames) { [Environment]::SetEnvironmentVariable($name, $originalEnvironment[$name], 'Process') }
}
