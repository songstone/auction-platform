param([string]$OutFile='results/environment.json')
$ErrorActionPreference='Stop'
Set-Location $PSScriptRoot
$javaPath='C:\Users\jitin81\.jdks\corretto-25.0.3\bin\java.exe'
$sourceFiles=Get-ChildItem src -Recurse -File | Sort-Object FullName
$hashes=@{}
foreach($file in $sourceFiles){$hashes[[IO.Path]::GetRelativePath($PSScriptRoot,$file.FullName)]=(Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash}
$data=@{
    capturedUtc=[DateTime]::UtcNow.ToString('o')
    os=[Environment]::OSVersion.VersionString
    logicalProcessors=[Environment]::ProcessorCount
    processorName=@((Get-CimInstance Win32_Processor).Name)
    physicalMemoryBytes=(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory
    java=@(& $javaPath --version)
    javaPath=$javaPath
    compilationRelease=25
    springBoot='3.5.16'
    maven='3.9.16'
    postgres=@(docker exec auction-spike-001-db psql -U spike -d spike001 -At -c 'SELECT version(); SHOW fsync; SHOW synchronous_commit; SHOW full_page_writes; SHOW track_commit_timestamp;')
    container=@(docker inspect auction-spike-001-db --format '{{.Image}} cpuNano={{.HostConfig.NanoCpus}} memoryBytes={{.HostConfig.Memory}}')
    jvmHeap='-Xms128m -Xmx512m per process'
    datasourcePool='16 maximum, 4 minimum per process'
    httpThreads='100 max / 8 minimum'
    sse='MVC SseEmitter; virtual thread per connection; bounded 64-message queue; 40ms poll; 1s heartbeat'
    topology='Same Windows host: client, two JVMs, Docker Linux PostgreSQL; loopback TCP'
    sourceSha256=$hashes
    jarSha256=(Get-FileHash -LiteralPath 'target/spike-001-0.0.1.jar' -Algorithm SHA256).Hash
}
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $OutFile) | Out-Null
$data | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $OutFile -Encoding utf8
Write-Output "Environment evidence written to $OutFile"
