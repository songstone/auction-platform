param([switch]$Database)
$ErrorActionPreference='Stop'
$jarPath=Join-Path $PSScriptRoot 'target\spike-001-0.0.1.jar'
foreach($port in 18081,18082){
    $pidPath=Join-Path $PSScriptRoot ".runtime\server-$port.pid"
    if(!(Test-Path -LiteralPath $pidPath)){continue}
    $experimentPid=[int](Get-Content -LiteralPath $pidPath -Raw).Trim()
    $experimentProcess=Get-CimInstance Win32_Process -Filter "ProcessId=$experimentPid"
    if(!$experimentProcess){Write-Output "Experiment port $port already stopped";continue}
    if(!$experimentProcess.CommandLine -or !$experimentProcess.CommandLine.Contains($jarPath)){
        throw "PID $experimentPid no longer belongs to this experiment; refusing to stop it"
    }
    Stop-Process -Id $experimentPid -Force
    Write-Output "Stopped experiment PID=$experimentPid port=$port"
}
if($Database){
    $purpose=docker inspect auction-spike-001-db --format '{{index .Config.Labels "purpose"}}'
    if($LASTEXITCODE -ne 0 -or $purpose -ne 'auction-spike-001'){throw 'Dedicated database identity mismatch'}
    docker stop auction-spike-001-db
    if($LASTEXITCODE -ne 0){throw 'Failed to stop dedicated experiment database'}
}
