$ErrorActionPreference = 'SilentlyContinue'
$secrets = @{
    cerebras = $env:CEREBRAS_API_KEY
    groq = $env:GROQ_API_KEY
    openrouter = $env:OPENROUTER_API_KEY
    gemini = $env:GEMINI_API_KEY
    github = if ($env:GITHUB_MODELS_TOKEN) { $env:GITHUB_MODELS_TOKEN } else { $env:GITHUB_TOKEN }
}
$urls = @{
    cerebras = 'https://api.cerebras.ai/v1/models'
    groq = 'https://api.groq.com/openai/v1/models'
    openrouter = 'https://openrouter.ai/api/v1/models'
    gemini = "https://generativelanguage.googleapis.com/v1beta/models?key=$([uri]::EscapeDataString([string]$secrets.gemini))"
    github = 'https://models.inference.ai.azure.com/models'
}

Write-Host 'ChatPay provider probe (no batch execution)' -ForegroundColor Cyan
$rows = foreach ($name in @('cerebras', 'groq', 'openrouter', 'gemini', 'github')) {
    if ([string]::IsNullOrWhiteSpace($secrets[$name])) {
        [pscustomobject]@{ Provider = $name; Status = 'ausente' }
        continue
    }
    try {
        $headers = @{}
        if ($name -ne 'gemini') { $headers.Authorization = "Bearer $($secrets[$name])" }
        $response = Invoke-WebRequest -Uri $urls[$name] -Method GET -Headers $headers -TimeoutSec 5 -UseBasicParsing
        [pscustomobject]@{ Provider = $name; Status = [int]$response.StatusCode }
    } catch {
        $status = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 'erro' }
        [pscustomobject]@{ Provider = $name; Status = $status }
    }
}
$rows | Format-Table -AutoSize
