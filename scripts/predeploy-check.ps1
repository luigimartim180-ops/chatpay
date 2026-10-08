$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$WranglerName = 'midas-core'
$failed = $false

function Fail([string]$Message) { Write-Host "FAIL $Message" -ForegroundColor Red; $script:failed = $true; throw $Message }
function Pass([string]$Message) { Write-Host "PASS $Message" -ForegroundColor Green }
function Run-Step([string]$Label, [scriptblock]$Action) {
    Write-Host "`n[$Label]" -ForegroundColor Cyan
    & $Action
    if ($LASTEXITCODE -ne 0) { Fail "$Label (exit $LASTEXITCODE)" }
    Pass $Label
}

Set-Location $Root
Write-Host 'ChatPay predeploy checklist (sem deploy)' -ForegroundColor White

Write-Host '[1] Wrangler Secrets' -ForegroundColor Cyan
$required = @('REDIS_URL','REDIS_TOKEN','RESEND_KEY','TARGET_EMAIL','MIDAS_SECRET','JWT_SECRET')
$secretJson = cmd.exe /d /c "npx.cmd wrangler secret list --name $WranglerName --format json 2>nul"
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace(($secretJson -join ''))) { Fail 'wrangler secret list não executou' }
$listed = @($secretJson | ConvertFrom-Json | ForEach-Object { $_.name })
$missing = @($required | Where-Object { $_ -notin $listed })
if ($missing.Count) { Fail ("Secrets ausentes: " + ($missing -join ', ')) }
Pass '6 secrets presentes'

Run-Step '2 node test-production-provider-boundary.js' { node test-production-provider-boundary.js }
$tests = @('test\test-phase1.js','test\test-phase2.js','test\test-phase3-kb.js','test\test-phase4-mafel.js','test\test-wa-coex.js','test-v23.js','test-v22.4.js','test-v22.1.2.js','test-v22.1.1.js','test-v22.1.js','test-v22.js','test-v22.2.js','test-v22.2-channels.js','test-v21.js','test-v20.js','test-v24-ux.js','test-v24-ux-edge.js')
foreach ($test in $tests) { Run-Step "3 $test" { node $test } }
Run-Step '3 demo' { node scripts/demo-conversation.js }
Run-Step '3 simulador' { node scripts/phase-e-simulator.js }

Write-Host '[4] padrões de chave no repositório' -ForegroundColor Cyan
$patterns = @('sk-' + 'or-', 'g' + 'sk_', 'A' + 'I' + 'za', 'r' + 'e_', 'gQ' + 'AA')
$files = Get-ChildItem -Path $Root -Recurse -File | Where-Object { $_.FullName -notmatch '\\(node_modules|\.git|\.wrangler)\\' -and $_.Name -notin @('.env','.env.local') }
$hits = @()
foreach ($file in $files) {
    $text = Get-Content -LiteralPath $file.FullName -Raw -ErrorAction SilentlyContinue
    foreach ($pattern in $patterns) { if ($text -and $text.Contains($pattern)) { $hits += $file.FullName } }
}
if ($hits.Count) { Fail ("padrões encontrados em $($hits.Count) arquivo(s)") }
Pass 'zero ocorrências'

Write-Host '[5] arquivos de segredo no workspace' -ForegroundColor Cyan
$secretFiles = @(Get-ChildItem -Path $Root -Recurse -Force -File -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch '\\(node_modules|\.git|\.wrangler)\\' -and ($_.Name -in @('.env','.env.local') -or $_.Extension -eq '.pem') })
if ($secretFiles.Count) { Fail ("arquivos proibidos: " + (($secretFiles | ForEach-Object Name) -join ', ')) }
Pass 'nenhum .env/.env.local/*.pem'

Write-Host "`nPREDEPLOY PASS" -ForegroundColor Green
exit 0
