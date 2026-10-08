# Upload da base de conhecimento (KB) para o Worker -> /api/kb/upload
# Uso: .\scripts\upload-kb.ps1 -Domain chatpay.oficial -File data\chatpay.kb.md
# Auth: key=MIDAS_SECRET (env CHATPAY_MIDAS_SECRET) OU token JWT (env CHATPAY_TOKEN)
# Obs: envia BYTES UTF-8 (PS5.1 truncava/mojibava o body string — causava chunks incompletos)
param(
  [string]$Domain = 'chatpay.oficial',
  [string]$File = 'data\chatpay.kb.md',
  [string]$Base = 'https://midas-core.novoronaldo-m.workers.dev'
)

$ErrorActionPreference = 'Stop'
$fullPath = (Resolve-Path -LiteralPath $File).Path
$content = [System.IO.File]::ReadAllText($fullPath, [System.Text.UTF8Encoding]::new($false))
if (-not $content) { throw "arquivo vazio: $File" }

$body = @{ domain = $Domain; filename = (Split-Path -Leaf $File); content = $content }
if ($env:CHATPAY_MIDAS_SECRET) { $body.key = $env:CHATPAY_MIDAS_SECRET }
elseif ($env:CHATPAY_TOKEN) { $body.token = $env:CHATPAY_TOKEN }
else { throw 'defina CHATPAY_MIDAS_SECRET ou CHATPAY_TOKEN no ambiente' }

$json = $body | ConvertTo-Json -Depth 5
$bytes = [System.Text.UTF8Encoding]::new($false).GetBytes($json)
$resp = Invoke-RestMethod -Uri "$Base/api/kb/upload" -Method Post -ContentType 'application/json; charset=utf-8' -Body $bytes
$resp | ConvertTo-Json -Depth 5
if ($resp.status -ne 'ok') { throw 'upload falhou' }
if ($resp.chunks -lt 2) { Write-Warning ("chunks=" + $resp.chunks + " (esperado >=2 para " + $content.Length + " chars) - conteudo pode ter truncado") }
Write-Output ("KB ok: domain=" + $resp.domain + " file=" + $resp.file + " chunks=" + $resp.chunks + " embedded=" + $resp.embedded)
