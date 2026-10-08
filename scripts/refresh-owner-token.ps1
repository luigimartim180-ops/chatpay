$ErrorActionPreference = 'Stop'
$ApiBase = if ($env:CHATPAY_API_BASE) { $env:CHATPAY_API_BASE.TrimEnd('/') } else { 'https://midas-core.novoronaldo-m.workers.dev' }
$email = $env:OWNER_EMAIL
if ([string]::IsNullOrWhiteSpace($email)) {
    Write-Host 'OWNER_EMAIL ausente. Execute: setx OWNER_EMAIL seu-email@dominio.com' -ForegroundColor Red
    exit 1
}
if ($email -notmatch '^[^@\s]+@[^@\s]+\.[^@\s]+$') {
    Write-Host 'OWNER_EMAIL inválido. Configure um email válido com setx OWNER_EMAIL.' -ForegroundColor Red
    exit 1
}
$payload = @{ domain = 'chatpay.oficial'; brand = 'ChatPay'; email = $email } | ConvertTo-Json -Compress
try {
    $response = Invoke-RestMethod -Uri "$ApiBase/start" -Method POST -Body $payload -ContentType 'application/json'
    $newToken = [string]$response.token
    if ([string]::IsNullOrWhiteSpace($newToken)) { throw 'resposta sem token' }
    & setx CHATPAY_TOKEN $newToken *> $null
    if ($LASTEXITCODE -ne 0) { throw 'setx falhou' }
    $env:CHATPAY_TOKEN = $newToken
    $masked = if ($newToken.Length -gt 8) { $newToken.Substring(0, 6) + '...' + $newToken.Substring($newToken.Length - 2, 2) } else { '******' }
    $expires = (Get-Date).ToUniversalTime().AddDays(30).ToString('yyyy-MM-ddTHH:mm:ssZ')
    Write-Host "CHATPAY_TOKEN atualizado. Máscara: $masked. Expira em: $expires"
} catch {
    Write-Host 'Falha ao atualizar CHATPAY_TOKEN.' -ForegroundColor Red
    exit 1
}
