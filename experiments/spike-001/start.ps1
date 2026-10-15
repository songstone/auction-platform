param([int]$Port=18081,[string]$PidFile='', [switch]$Recover,[string]$JavaHome='C:\Users\jitin81\.jdks\corretto-25.0.3')
$ErrorActionPreference='Stop'
$runtimeVersion=& (Join-Path $JavaHome 'bin/java.exe') --version
if($LASTEXITCODE -ne 0 -or $runtimeVersion[0] -notmatch '^(openjdk|java) 25[. ]'){throw 'SPIKE-001 requires Java 25'}
$runtime=Join-Path $PSScriptRoot '.runtime'
$dbCredential=Get-Content -LiteralPath (Join-Path $runtime 'db.json') -Raw | ConvertFrom-Json
$env:SPIKE_DB_PASSWORD=$dbCredential.password
$env:SPIKE_PORT="$Port"
$jar=Join-Path $PSScriptRoot 'target/spike-001-0.0.1.jar'
if(!(Test-Path -LiteralPath $jar)){throw 'Build the experiment first'}
$arguments=@('-Xms128m','-Xmx512m','-jar',('"'+$jar+'"'))
if($Recover){$arguments+='--spike.recover-on-start=true'}
$process=Start-Process -FilePath (Join-Path $JavaHome 'bin/java.exe') -ArgumentList $arguments -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtime "server-$Port.log") -RedirectStandardError (Join-Path $runtime "server-$Port.err.log") -PassThru
Remove-Item Env:SPIKE_DB_PASSWORD
if(!$PidFile){$PidFile=Join-Path $runtime "server-$Port.pid"}
$process.Id | Set-Content -LiteralPath $PidFile
Write-Output "Started experiment PID=$($process.Id) port=$Port"
