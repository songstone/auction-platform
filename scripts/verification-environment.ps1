function Clear-VerificationEnvironment {
    $removed = @{}
    foreach ($entry in Get-ChildItem Env:) {
        if ($entry.Name.Replace('.', '_') -match '^(SPRING_|DB_|SERVER_|MANAGEMENT_|MAIL_|PHOTO_)|^(JAVA_TOOL_OPTIONS|JDK_JAVA_OPTIONS|_JAVA_OPTIONS|JAVA_OPTS|GRADLE_OPTS)$') {
            $removed[$entry.Name] = $entry.Value
            Remove-Item -LiteralPath "Env:$($entry.Name)"
        }
    }
    return $removed
}

function Restore-VerificationEnvironment([hashtable]$Removed) {
    foreach ($name in $Removed.Keys) { Set-Item -LiteralPath "Env:$name" -Value $Removed[$name] }
}
