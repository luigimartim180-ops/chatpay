param(
    [Parameter(Mandatory=$true)]
    [string]$Secret
)

$url = "https://midas-core.novoronaldo-m.workers.dev/confirm?last=1"
curl.exe -s -H "x-midas-secret: $Secret" $url
