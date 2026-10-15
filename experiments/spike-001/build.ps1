param([string]$JavaHome='C:\Users\jitin81\.jdks\corretto-25.0.3')
$ErrorActionPreference='Stop'
Set-Location $PSScriptRoot
$env:JAVA_HOME=$JavaHome
$runtimeVersion=& (Join-Path $JavaHome 'bin/java.exe') --version
if($runtimeVersion[0] -notmatch '^(openjdk|java) 25[. ]'){throw 'SPIKE-001 requires Java 25'}
$runtimeVersion
& .\mvnw.cmd -B -ntp package
if($LASTEXITCODE -ne 0){throw 'SPIKE-001 build failed'}
