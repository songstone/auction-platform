#requires -Version 7.0
param(
    [string]$JavaHome = $env:AUCTION_JAVA_HOME,
    [string]$PythonExe = 'python'
)
$ErrorActionPreference = 'Stop'
$repoPath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$originalJavaHome = $env:JAVA_HOME
$originalPath = $env:PATH
$originalPythonEncoding = $env:PYTHONIOENCODING
$originalLocation = Get-Location
try {
    Set-Location $repoPath
    & $PythonExe -X utf8 scripts/check-approved-baseline.py --strict-evidence
    if ($LASTEXITCODE -ne 0) { throw 'Approved baseline drift; use the contract change procedure.' }
    & $PythonExe -X utf8 scripts/test-baseline-guard.py
    if ($LASTEXITCODE -ne 0) { throw 'Baseline mutation checks failed.' }
    if (!$JavaHome) { $JavaHome = $env:JAVA_HOME }
    if (!$JavaHome) { throw 'Set AUCTION_JAVA_HOME or pass -JavaHome with a JDK 25 directory.' }
    $javaExe = Join-Path $JavaHome 'bin/java.exe'
    if (!(Test-Path -LiteralPath $javaExe)) { throw 'JDK java.exe not found.' }
    $javaVersion = (& $javaExe -version 2>&1 | Out-String)
    if ($javaVersion -notmatch 'version "25(?:\.|\")') { throw 'JDK 25 is required; global Java settings are not changed.' }
    $env:JAVA_HOME = [System.IO.Path]::GetFullPath($JavaHome)
    $env:PATH = "$(Join-Path $env:JAVA_HOME 'bin');$originalPath"
    $env:PYTHONIOENCODING = 'utf-8'
    $venvPath = Join-Path $repoPath '.venv'
    $contractPython = Join-Path $venvPath 'Scripts/python.exe'
    if (!(Test-Path -LiteralPath $contractPython)) {
        & $PythonExe -m venv $venvPath
        if ($LASTEXITCODE -ne 0) { throw 'Contract tool virtualenv creation failed.' }
    }
    & $contractPython -m pip install --disable-pip-version-check -r contracts/requirements-validation.txt
    if ($LASTEXITCODE -ne 0) { throw 'Pinned contract tools installation failed.' }
    & $contractPython -X utf8 scripts/verify-contracts.py
    if ($LASTEXITCODE -ne 0) { throw 'Contract validation failed.' }
    Push-Location (Join-Path $repoPath 'backend')
    try {
        & .\gradlew.bat --no-daemon --console=plain clean build
        if ($LASTEXITCODE -ne 0) { throw 'Backend verification failed.' }
    } finally { Pop-Location }
    Push-Location (Join-Path $repoPath 'frontend')
    try {
        & npm.cmd ci --no-fund --no-audit
        if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }
        & npm.cmd test
        if ($LASTEXITCODE -ne 0) { throw 'Frontend fixture/contract checks failed.' }
        & npm.cmd run build
        if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
    } finally { Pop-Location }
    & $PythonExe -X utf8 scripts/check-approved-baseline.py --strict-evidence
    if ($LASTEXITCODE -ne 0) { throw 'Verification modified approved files.' }
    Write-Output 'FOUNDATION_CHECKS / PASS. Business, session, auction concurrency, SSE recovery and performance acceptance are separate.'
} finally {
    $env:JAVA_HOME = $originalJavaHome
    $env:PATH = $originalPath
    $env:PYTHONIOENCODING = $originalPythonEncoding
    Set-Location $originalLocation
}
