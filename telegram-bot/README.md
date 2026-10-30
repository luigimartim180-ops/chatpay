# Bot Telegram ChatPay — utilitários locais

Scripts pequenos para desenvolvimento e diagnóstico. Eles usam `fetch` nativo do Node e não fazem parte do Worker Cloudflare.

## Segurança — importante

O histórico deste repositório continha um token Telegram em texto puro. **Considere-o comprometido e revogue-o no @BotFather antes de continuar.** Um token removido do arquivo atual ainda pode existir no histórico Git e em clones/artefatos antigos. Gere um token novo e não o reutilize em exemplos, commits ou mensagens.

Forneça o token apenas pelo ambiente. O código não carrega automaticamente arquivos `.env`:

```bash
# Linux/macOS
export BOT_TOKEN='SEU_TOKEN_NOVO'

# PowerShell
$env:BOT_TOKEN = 'SEU_TOKEN_NOVO'
```

Use um bot de desenvolvimento separado do bot que recebe webhooks em produção. `getUpdates` e webhooks não devem ser usados simultaneamente no mesmo bot. Os scripts **não apagam nem alteram webhooks automaticamente**.

## Requisitos e uso

Requer Node.js 18 ou superior. Execute a partir da raiz do repositório ou de qualquer diretório; os caminhos de saída são resolvidos em relação aos scripts.

1. Capturar o Chat ID: `node telegram-bot/get-chat-id.mjs`; envie `/start` ao bot.
2. Iniciar o bot de exemplo: `node telegram-bot/bot.mjs`.
3. Comandos disponíveis: `/start` e `/id`.

O Chat ID é salvo em `telegram-bot/chat_id.json`, arquivo local ignorado pelo Git. Se o Telegram indicar que há webhook ativo, confirme qual aplicação usa esse bot antes de alterar a configuração.
