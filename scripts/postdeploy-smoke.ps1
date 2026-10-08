$ErrorActionPreference = 'Stop'
$Base = if ($env:CHATPAY_API_BASE) { $env:CHATPAY_API_BASE.TrimEnd('/') } else { 'https://midas-core.novoronaldo-m.workers.dev' }
$token = $env:CHATPAY_TOKEN
$results = @()

function Add-Check([string]$Name, [scriptblock]$Action) {
    try { & $Action; $script:results += [pscustomobject]@{ Check = $Name; Status = 'PASS' } }
    catch { $script:results += [pscustomobject]@{ Check = $Name; Status = 'FAIL' }; Write-Host "FAIL $Name" -ForegroundColor Red }
}
function Get-Json([string]$Uri) {
    try {
        $response = Invoke-WebRequest -Uri $Uri -Method GET -UseBasicParsing
        return @{ Status = [int]$response.StatusCode; Body = ($response.Content | ConvertFrom-Json) }
    } catch {
        # PowerShell 5.1 lança exceção em 4xx/5xx; extrai o status da resposta
        $statusCode = 0
        try { $statusCode = [int]$_.Exception.Response.StatusCode } catch { }
        if ($statusCode -gt 0) { return @{ Status = $statusCode; Body = $null } }
        throw
    }
}

Write-Host 'ChatPay postdeploy smoke (sem deploy)' -ForegroundColor Cyan
if ([string]::IsNullOrWhiteSpace($token)) {
    Write-Host 'FAIL CHATPAY_TOKEN ausente. Rode scripts/refresh-owner-token.ps1.' -ForegroundColor Red
    exit 1
}

Add-Check 'GET / (200 online)' {
    $r = Get-Json "$Base/"
    if ($r.Status -ne 200 -or $r.Body.status -ne 'online') { throw 'status inesperado' }
}
Add-Check 'GET /api/integrations?token=abc (401)' {
    $r = Get-Json "$Base/api/integrations?token=abc"
    if ($r.Status -ne 401) { throw "HTTP $($r.Status)" }
}
Add-Check 'GET /api/agent-graph (200 contadores)' {
    $r = Get-Json "$Base/api/agent-graph?token=$([uri]::EscapeDataString($token))"
    if ($r.Status -ne 200 -or $null -eq $r.Body) { throw 'resposta inválida' }
    $hasCounter = @('agentes','pipeline','nodes','edges','total','count','counters') | Where-Object { $null -ne $r.Body.$_ }
    if (-not $hasCounter) { throw 'contadores ausentes' }
}
Add-Check 'GET /api/v23/roi (200)' {
    $r = Get-Json "$Base/api/v23/roi?token=$([uri]::EscapeDataString($token))"
    if ($r.Status -ne 200) { throw "HTTP $($r.Status)" }
}
Add-Check 'GET /api/v23/decision-report (200)' {
    $r = Get-Json "$Base/api/v23/decision-report?token=$([uri]::EscapeDataString($token))"
    if ($r.Status -ne 200) { throw "HTTP $($r.Status)" }
}
Add-Check 'GET /pay?d=chatpay.oficial (200 com produto)' {
    $r = Invoke-WebRequest -Uri "$Base/pay?d=chatpay.oficial" -Method GET -UseBasicParsing
    if ([int]$r.StatusCode -ne 200 -or $r.Content -notmatch 'ChatPay|produto|Produto') { throw 'produto não encontrado' }
}

$results | Format-Table -AutoSize
try {
    # EAP=Stop converte stderr do npx em exceção → desliga durante o wrangler
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    # Lista em ordem cronológica (mais recente por último) → pega a ÚLTIMA Version(s)
    $lines = & npx.cmd wrangler deployments list --name midas-core 2>$null
    $ErrorActionPreference = $prevEAP
    $version = $lines | Select-String -Pattern 'Version\(s\):.*[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | Select-Object -Last 1
    if ($version) { Write-Host "Version ID atual: $version" } else { Write-Host 'Version ID atual: indisponível' -ForegroundColor Yellow }
} catch { Write-Host 'Version ID atual: indisponível' -ForegroundColor Yellow }
if (($results | Where-Object Status -eq 'FAIL').Count) { exit 1 }
Write-Host 'POSTDEPLOY PASS' -ForegroundColor Green
exit 0
