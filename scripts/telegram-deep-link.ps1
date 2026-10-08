# Gera deep link (Fase 1) para um domínio no master bot compartilhado.
# Requer: CHATPAY_TOKEN (owner), master já configurado via POST /api/telegram/master.
#
# .\scripts\telegram-deep-link.ps1 -Domain loja.joao
# .\scripts\telegram-deep-link.ps1 -Domain loja.joao -Token $env:CHATPAY_TOKEN

param(
    [Parameter(Mandatory = $true)][string]$Domain,
    [string]$Token = $env:CHATPAY_TOKEN,
    [string]$ApiBase = 'https://midas-core.novoronaldo-m.workers.dev'
)

$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($Token)) {
    Write-Host 'CHATPAY_TOKEN ausente. Rode scripts/refresh-owner-token.ps1 ou passe -Token.' -ForegroundColor Red
    exit 1
}
$uri = "$ApiBase/api/telegram/deep-link?token=$([uri]::EscapeDataString($Token))&domain=$([uri]::EscapeDataString($Domain))"
try {
    $res = Invoke-RestMethod -Uri $uri -Method Get
} catch {
    Write-Host "Falha ao gerar deep link: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host $reader.ReadToEnd() -ForegroundColor Yellow
    }
    exit 1
}
Write-Host "Domain:  $($res.domain)" -ForegroundColor Cyan
Write-Host "Bot:     $($res.bot)" -ForegroundColor Cyan
Write-Host "Deep:    $($res.deep_link)" -ForegroundColor Green
Write-Host "Payload: $($res.start_payload)" -ForegroundColor Green
Write-Host "QR:      $($res.qr)" -ForegroundColor Green
$res | ConvertTo-Json -Depth 4
