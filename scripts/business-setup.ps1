param([string]$PixKey = $env:CHATPAY_PIX_KEY)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$ApiBase = if ($env:CHATPAY_API_BASE) { $env:CHATPAY_API_BASE.TrimEnd('/') } else { 'https://midas-core.novoronaldo-m.workers.dev' }
$Domain = 'chatpay.oficial'
$Email = $env:OWNER_EMAIL

function Stop-Safely([string]$Message) { Write-Host $Message -ForegroundColor Red; exit 1 }
if ([string]::IsNullOrWhiteSpace($Email) -or $Email -notmatch '^[^@\s]+@[^@\s]+\.[^@\s]+$') {
    Stop-Safely 'OWNER_EMAIL ausente ou inválido. Configure: setx OWNER_EMAIL seu-email@dominio.com'
}
if ([string]::IsNullOrWhiteSpace($PixKey)) {
    Stop-Safely 'CHATPAY_PIX_KEY ausente. Configure a chave Pix em $env:CHATPAY_PIX_KEY.'
}

function Start-OwnerToken {
    $payload = @{ domain = $Domain; brand = 'ChatPay'; email = $Email } | ConvertTo-Json -Compress
    $started = Invoke-RestMethod -Uri "$ApiBase/start" -Method POST -Body $payload -ContentType 'application/json'
    $value = [string]$started.token
    if ([string]::IsNullOrWhiteSpace($value)) { throw 'start sem token' }
    & setx CHATPAY_TOKEN $value *> $null
    if ($LASTEXITCODE -ne 0) { throw 'setx CHATPAY_TOKEN falhou' }
    $env:CHATPAY_TOKEN = $value
    return $value
}

$Token = $env:CHATPAY_TOKEN
if (-not [string]::IsNullOrWhiteSpace($Token)) {
    try {
        $me = Invoke-RestMethod -Uri "$ApiBase/api/me?token=$([uri]::EscapeDataString($Token))" -Method GET
        if ($me.domain -ne $Domain -or ([datetime]$me.expires) -le (Get-Date).ToUniversalTime()) { $Token = $null }
    } catch { $Token = $null }
}
if ([string]::IsNullOrWhiteSpace($Token)) {
    try { $Token = Start-OwnerToken } catch { Stop-Safely 'Não foi possível validar ou renovar CHATPAY_TOKEN.' }
}

try {
    $pix = @{ token = $Token; key = $PixKey; name = 'ChatPay' } | ConvertTo-Json -Compress
    Invoke-RestMethod -Uri "$ApiBase/api/pix" -Method POST -Body $pix -ContentType 'application/json' | Out-Null
    $product = @{ token = $Token; name = 'ChatPay Trial 30d'; cents = 9700; deliver = "$ApiBase/dash" } | ConvertTo-Json -Compress
    Invoke-RestMethod -Uri "$ApiBase/api/product" -Method POST -Body $product -ContentType 'application/json' | Out-Null
    Write-Host 'Business setup concluído. Token mantido somente em ambiente externo.' -ForegroundColor Green
} catch {
    Stop-Safely 'Falha no business setup; nenhum token foi impresso.'
}
