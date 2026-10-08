<#
.SYNOPSIS
  Onboarding rápido de Telegram multi-cliente (1 ou 20 clientes em lote).

.EXAMPLE
  # Um cliente
  .\scripts\onboard-telegram.ps1 -Domain loja.cli1 -BotToken "123456:ABC-DEF"

  # Vários clientes (CSV: domain,bot_token)
  .\scripts\onboard-telegram.ps1 -Csv clientes-telegram.csv

  # Forçar novo token de dono
  .\scripts\onboard-telegram.ps1 -Domain loja.cli1 -BotToken "123:ABC" -RefreshOwner
#>
param(
  [string]$Domain,
  [string]$BotToken,
  [string]$Csv,
  [string]$Token = $env:CHATPAY_TOKEN,
  [string]$Email = $env:OWNER_EMAIL,
  [switch]$RefreshOwner
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$ApiBase = if ($env:CHATPAY_API_BASE) { $env:CHATPAY_API_BASE.TrimEnd('/') } else { 'https://midas-core.novoronaldo-m.workers.dev' }

function Get-OwnerToken {
  if (-not $RefreshOwner -and -not [string]::IsNullOrWhiteSpace($Token)) { return $Token }
  if ([string]::IsNullOrWhiteSpace($Email)) {
    throw 'Defina OWNER_EMAIL (setx OWNER_EMAIL seu@email.com) ou passe -Token JWT do cliente.'
  }
  $payload = @{ domain = 'chatpay.oficial'; brand = 'ChatPay'; email = $Email } | ConvertTo-Json -Compress
  $r = Invoke-RestMethod -Uri "$ApiBase/start" -Method POST -Body $payload -ContentType 'application/json'
  if ([string]::IsNullOrWhiteSpace($r.token)) { throw '/start não retornou token' }
  $env:CHATPAY_TOKEN = $r.token
  return [string]$r.token
}

function Start-ClientDomain([string]$Dom, [string]$OwnerTok) {
  # Token por domínio do cliente (trial 30d) — usado no channel-config
  $payload = @{ domain = $Dom; brand = $Dom; email = $Email } | ConvertTo-Json -Compress
  $r = Invoke-RestMethod -Uri "$ApiBase/start" -Method POST -Body $payload -ContentType 'application/json'
  if ([string]::IsNullOrWhiteSpace($r.token)) { throw "start falhou para domain=$Dom" }
  return [string]$r.token
}

function Connect-Telegram([string]$Dom, [string]$BotTok, [string]$OwnerTok) {
  if ([string]::IsNullOrWhiteSpace($Dom) -or [string]::IsNullOrWhiteSpace($BotTok)) {
    throw 'Domain e BotToken obrigatórios'
  }
  $clientTok = Start-ClientDomain -Dom $Dom -OwnerTok $OwnerTok
  $body = @{ token = $clientTok; tg_bot_token = $BotTok.Trim() } | ConvertTo-Json -Compress
  try {
    $res = Invoke-RestMethod -Uri "$ApiBase/api/channel-config/telegram" -Method POST -Body $body -ContentType 'application/json'
    Write-Host ("OK  {0} => @{1} webhook={2}" -f $Dom, $res.webhook.bot, $res.webhook.url) -ForegroundColor Green
    return $true
  } catch {
    $msg = $_.Exception.Message
    if ($_.Exception.Response) {
      try {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $msg = $reader.ReadToEnd()
      } catch { }
    }
    Write-Host ("ERRO {0}: {1}" -f $Dom, $msg) -ForegroundColor Red
    return $false
  }
}

$owner = Get-OwnerToken
$ok = 0; $fail = 0

if ($Csv) {
  $rows = Import-Csv -Path $Csv
  foreach ($row in $rows) {
    $d = $row.domain; $t = $row.bot_token
    if (Connect-Telegram -Dom $d -BotTok $t -OwnerTok $owner) { $ok++ } else { $fail++ }
  }
} elseif ($Domain -and $BotToken) {
  if (Connect-Telegram -Dom $Domain -BotTok $BotToken -OwnerTok $owner) { $ok++ } else { $fail++ }
} else {
  Write-Host 'Uso: -Domain x -BotToken "123:ABC"  |  -Csv arquivo.csv (colunas: domain,bot_token)' -ForegroundColor Yellow
  exit 1
}

Write-Host "Concluído: $ok ok, $fail falha(s)." -ForegroundColor Cyan
if ($fail -gt 0) { exit 1 }
