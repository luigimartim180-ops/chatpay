// PowerShell: defina BASE, TOKEN, DOMAIN, TXID, PHONE e CLICK_SIGN_SECRET antes.
// 1. Configurar Clicksign e criar documento para uma transacao paga.
// curl.exe -X POST "$env:BASE/api/integration-clicksign" -H 'Content-Type: application/json' -d "{\"token\":\"$env:TOKEN\",\"apiKey\":\"staging-key\",\"templateId\":\"template-id\",\"webhookSecret\":\"$env:CLICK_SIGN_SECRET\"}"
// curl.exe -X POST "$env:BASE/api/sign-create" -H 'Content-Type: application/json' -d "{\"token\":\"$env:TOKEN\",\"txid\":\"$env:TXID\",\"signerEmail\":\"cliente@example.com\"}"
// 2. Simular callback Clicksign. O parametro d identifica a configuracao Redis.
// curl.exe -X POST "$env:BASE/webhook/clicksign?d=$env:DOMAIN" -H "x-clicksign-secret: $env:CLICK_SIGN_SECRET" -H 'Content-Type: application/json' -d "{\"txid\":\"$env:TXID\",\"status\":\"signed\"}"
// 3. Configurar WhatsApp e validar o desafio Meta.
// curl.exe -X POST "$env:BASE/api/integration-whatsapp" -H 'Content-Type: application/json' -d "{\"token\":\"$env:TOKEN\",\"phoneId\":\"phone-id\",\"accessToken\":\"staging-token\",\"templateName\":\"chatpay_payment\",\"verifyToken\":\"verify-token\",\"price\":\"29,00\"}"
// curl.exe "$env:BASE/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=verify-token&hub.challenge=123"
// 4. Enviar botao WhatsApp com fallback para /pay quando a Meta falhar.
// curl.exe -X POST "$env:BASE/api/wa-send-button" -H 'Content-Type: application/json' -d "{\"token\":\"$env:TOKEN\",\"phone\":\"$env:PHONE\",\"productId\":\"produto\",\"price\":29}"
// 5. Ler analytics e leads do Hunter com JWT do cliente.
// curl.exe "$env:BASE/api/hunter-analytics?d=$env:DOMAIN&token=$env:TOKEN"
// curl.exe "$env:BASE/api/hunter-leads?d=$env:DOMAIN&limit=50&token=$env:TOKEN"
