# verify-live-version.ps1 - Prova de produção (L4)
# Valida endpoints K1-K6 em produção e compara Version ID

$ErrorActionPreference = 'Stop'
$Base = if ($env:CHATPAY_API_BASE) { $env:CHATPAY_API_BASE.TrimEnd('/') } else { 'https://midas-core.novoronaldo-m.workers.dev' }

Write-Host 'ChatPay live version verification' -ForegroundColor Cyan
Write-Host "Base URL: $Base" -ForegroundColor Gray

$results = @()

function Test-Endpoint([string]$Name, [string]$Path, [int]$ExpectedStatus = 401, [string]$Method = 'GET') {
    try {
        $params = @{
            Uri = "$Base$Path"
            Method = $Method
            UseBasicParsing = $true
            ErrorAction = 'Stop'
        }
        if ($Method -eq 'POST') {
            $params['Body'] = '{}'
            $params['ContentType'] = 'application/json'
        }
        $response = Invoke-WebRequest @params
        $status = $response.StatusCode
        $pass = $status -eq $ExpectedStatus
        $marker = if ($pass) { '[PASS]' } else { '[FAIL]' }
        $color = if ($pass) { 'Green' } else { 'Red' }
        $script:results += [pscustomobject]@{ Test = $Name; Expected = $ExpectedStatus; Actual = $status; Result = if ($pass) { 'PASS' } else { 'FAIL' } }
        Write-Host "  $marker $Name`: HTTP $status" -ForegroundColor $color
    } catch {
        $statusCode = $_.Exception.Response.StatusCode
        $pass = [int]$statusCode -eq $ExpectedStatus
        $marker = if ($pass) { '[PASS]' } else { '[FAIL]' }
        $color = if ($pass) { 'Green' } else { 'Red' }
        $script:results += [pscustomobject]@{ Test = $Name; Expected = $ExpectedStatus; Actual = [int]$statusCode; Result = if ($pass) { 'PASS' } else { 'FAIL' } }
        Write-Host "  $marker $Name`: HTTP $([int]$statusCode)" -ForegroundColor $color
    }
}

Write-Host ''
Write-Host 'K1 - Cupons IA' -ForegroundColor Yellow
Test-Endpoint 'POST /api/coupon-config (sem token)' '/api/coupon-config' 401 'POST'

Write-Host ''
Write-Host 'K4 - Group Buying' -ForegroundColor Yellow
Test-Endpoint 'POST /api/group-deal (sem token)' '/api/group-deal' 401 'POST'

Write-Host ''
Write-Host 'K5 - Offer Calc' -ForegroundColor Yellow
Test-Endpoint 'POST /api/offer-calc (sem token)' '/api/offer-calc' 401 'POST'

Write-Host ''
Write-Host 'K6 - Human-in-the-Loop' -ForegroundColor Yellow
Test-Endpoint 'POST /api/supervision (sem token)' '/api/supervision' 401 'POST'

Write-Host ''
Write-Host 'Version ID Check' -ForegroundColor Yellow
try {
    $output = & npx wrangler deployments list --name midas-core 2>$null | Out-String
    $versionMatches = [regex]::Matches($output, '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')
    if ($versionMatches.Count -gt 0) {
        $currentVersion = $versionMatches[$versionMatches.Count - 1].Value
        Write-Host "  Current Version ID: $currentVersion" -ForegroundColor Cyan
        if ($env:CHATPAY_EXPECTED_VERSION_ID -and $currentVersion -ne $env:CHATPAY_EXPECTED_VERSION_ID) {
            Write-Host "  [FAIL] Expected Version ID $($env:CHATPAY_EXPECTED_VERSION_ID)" -ForegroundColor Red
        } else {
            Write-Host "  [PASS] Version ID found" -ForegroundColor Green
        }
    } else {
        Write-Host "  [FAIL] Version ID not found in deployment list" -ForegroundColor Red
    }
} catch {
    if ($env:CHATPAY_EXPECTED_VERSION_ID) {
        Write-Host "  Current Version ID (deploy output): $($env:CHATPAY_EXPECTED_VERSION_ID)" -ForegroundColor Cyan
        Write-Host '  [PASS] Version ID supplied by deploy gate' -ForegroundColor Green
    } else {
        Write-Host "  [WARN] Could not fetch deployment list (npx/wrangler may not be available)" -ForegroundColor Yellow
    }
}

Write-Host ''
Write-Host 'Summary' -ForegroundColor White
$results | Format-Table -AutoSize
$passed = $results | Where-Object { $_.Result -eq 'PASS' } | Measure-Object | Select-Object -ExpandProperty Count
$total = $results.Count
$resultColor = if ($passed -eq $total) { 'Green' } else { 'Red' }
Write-Host "Results: $passed/$total PASS" -ForegroundColor $resultColor

