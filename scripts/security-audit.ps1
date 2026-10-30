$ErrorActionPreference = 'Stop'
if ($env:ALLOW_LIVE_API_TESTS -ne '1') {
    Write-Host 'SKIP: defina ALLOW_LIVE_API_TESTS=1 para autorizar chamadas HTTP ao vivo.' -ForegroundColor Yellow
    exit 2
}
if ([string]::IsNullOrWhiteSpace($env:CHATPAY_API_BASE)) {
    Write-Host 'FAIL: CHATPAY_API_BASE explícito é obrigatório; nenhum alvo padrão de produção será usado.' -ForegroundColor Red
    exit 1
}
$Base = $env:CHATPAY_API_BASE.TrimEnd('/')
$Token = $env:CHATPAY_TOKEN
$results = @()
[void][System.Reflection.Assembly]::LoadWithPartialName('System.Net.Http')

function Invoke-AuditRequest([string]$Name, [string]$Method, [string]$Path, [int]$ExpectedStatus, [string]$Body = $null) {
    $actual = 0
    try {
        $params = @{ Uri = "$Base$Path"; Method = $Method; UseBasicParsing = $true; ErrorAction = 'Stop' }
        if (-not [string]::IsNullOrEmpty($Body)) { $params['Body'] = $Body; $params['ContentType'] = 'application/json' }
        $actual = [int](Invoke-WebRequest @params).StatusCode
    } catch {
        $status = $_.Exception.Response.StatusCode
        $actual = if ($status) { [int]$status.value__ } else { -1 }
    }
    $pass = $actual -eq $ExpectedStatus
    $script:results += [pscustomobject]@{ Test = $Name; Expected = $ExpectedStatus; Actual = $actual; Result = if ($pass) { 'PASS' } else { 'FAIL' } }
    $marker = if ($pass) { '[PASS]' } else { '[FAIL]' }
    $color = if ($pass) { 'Green' } else { 'Red' }
    Write-Host "  $marker $Name`: HTTP $actual (expected $ExpectedStatus)" -ForegroundColor $color
}

Write-Host "ChatPay security audit: $Base" -ForegroundColor Cyan
$contractPath = Join-Path $PSScriptRoot '..\docs\api-contract-k.md'
$contractRows = Get-Content $contractPath | Where-Object { $_ -match '^\|\s*`?/api/' }
$contract = foreach ($row in $contractRows) {
    $cells = $row.Trim('|').Split('|') | ForEach-Object { $_.Trim().Trim('`') }
    if ($cells.Count -ge 5 -and $cells[1] -in @('GET', 'POST')) { [pscustomobject]@{ Route = $cells[0]; Method = $cells[1]; Auth = $cells[2]; Status = $cells[3]; Body = $cells[4] } }
}

function AuditPath([string]$Route) { if ($Route.Contains(':id')) { return $Route.Replace(':id', 'missing') }; return $Route }
function AuditBody([string]$Method, [string]$Token) { if ($Method -eq 'POST') { return ('{"token":"' + $Token + '"}') }; return $null }
function AuditQuery([string]$Route, [string]$Token) {
    $suffix = if ($Route -eq '/api/offer-calc') { '&cents=1000' } else { '' }
    return "$(AuditPath $Route)?token=$Token$suffix"
}

Write-Host 'A - Requests without token must fail with 401 (matrix-driven)' -ForegroundColor Yellow
foreach ($entry in $contract) {
    $path = AuditPath $entry.Route
    if ($entry.Method -eq 'GET') { $path = AuditQuery $entry.Route '' }
    Invoke-AuditRequest "$($entry.Method) $($entry.Route) sem token" $entry.Method $path 401 (AuditBody $entry.Method '')
}

Write-Host 'B - Requests with valid token must pass' -ForegroundColor Yellow
if ([string]::IsNullOrWhiteSpace($Token)) {
    Write-Host '  [FAIL] CHATPAY_TOKEN ausente; execute scripts/refresh-owner-token.ps1' -ForegroundColor Red
    $results += [pscustomobject]@{ Test = 'CHATPAY_TOKEN presente'; Expected = 1; Actual = 0; Result = 'FAIL' }
} else {
    $encodedToken = [uri]::EscapeDataString($Token)
    foreach ($entry in $contract | Where-Object { $_.Method -eq 'GET' }) {
        Invoke-AuditRequest "GET $($entry.Route) token válido" 'GET' (AuditQuery $entry.Route $encodedToken) 200
    }
    Invoke-AuditRequest 'GET /api/me token válido' 'GET' "/api/me?token=$encodedToken" 200
}

Write-Host 'C - Requests with invalid token must fail with 401 (matrix-driven)' -ForegroundColor Yellow
foreach ($entry in $contract) {
    $path = AuditPath $entry.Route
    if ($entry.Method -eq 'GET') { $path = AuditQuery $entry.Route 'abc' }
    Invoke-AuditRequest "$($entry.Method) $($entry.Route) token inválido" $entry.Method $path 401 (AuditBody $entry.Method 'abc')
}

$failed = @($results | Where-Object { $_.Result -eq 'FAIL' })
$passed = @($results | Where-Object { $_.Result -eq 'PASS' })
Write-Host ''
$results | Format-Table -AutoSize
$color = if ($failed.Count -eq 0) { 'Green' } else { 'Red' }
Write-Host "Security audit: $($passed.Count)/$($results.Count) PASS" -ForegroundColor $color
if ($failed.Count -gt 0) { exit 1 }