powershell -ExecutionPolicy Bypass -File scripts\predeploy-check.ps1
if ($LASTEXITCODE -ne 0) { exit 1 }
$lines = (Get-Content src\services\message-queue.js | Measure-Object -Line).Lines
Write-Output "{`"lines`": $lines}"
