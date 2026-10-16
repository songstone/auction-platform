#requires -Version 7.0
$ErrorActionPreference = 'Stop'
$runtimePath = Join-Path $PSScriptRoot '.runtime'
New-Item -ItemType Directory -Path $runtimePath -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $runtimePath 'photos') -Force | Out-Null
$passwordPath = Join-Path $runtimePath 'db-password'
if (!(Test-Path -LiteralPath $passwordPath)) {
    $bytes = [byte[]]::new(32)
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
    [System.IO.File]::WriteAllText($passwordPath, [Convert]::ToBase64String($bytes), [System.Text.UTF8Encoding]::new($false))
}
if ([string]::IsNullOrWhiteSpace([System.IO.File]::ReadAllText($passwordPath))) { throw 'Local DB password file is empty.' }
Write-Output 'Local DB secret and photo directory prepared in ignored infra/.runtime; existing credentials preserved.'
