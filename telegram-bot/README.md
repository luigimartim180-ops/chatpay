# 🤖 Bot Telegram ChatPay - Guia de Uso

## 📦 Instalação Rápida

1. **Certifique-se de ter o Node.js 18+ instalado**
2. **Entre na pasta do bot:**
   ```bash
   cd D:\chatpay\telegram-bot
   ```
3. **Verifique se o `.env` existe** com seu BOT_TOKEN:
   ```bash
   type .env
   ```
   Deve aparecer: `BOT_TOKEN=8683827538:AAEGG7F0-b9wPCj-F3fEzKaf-4P5RyidImA`

## ▶️ Como Rodar

### **1. Obter seu Chat ID**
Execute o script de captura:
```bash
node D:\chatpay\telegram-bot\get-chat-id.mjs
```
- Envie `/start` para o seu bot no Telegram
- Aguarde a mensagem aparecer na tela
- O ID será salvo em `telegram-bot/chat_id.json`

### **2. Rodar o Bot Principal**
```bash
node D:\chatpay\telegram-bot\bot.mjs
```

### **3. Testar os Comandos no Telegram**

No Telegram (conversa com seu bot):

- **`/start`** → Boas-vindas + seu Chat ID é salvo automaticamente
- **`/id`** → Bot responde com seu Chat ID da conversa
- **Outros comandos** → Bot responde: "Comando não reconhecido"

## 💾 Como Recuperar o ID

Se você perder o Chat ID, basta:

1. Excluir a pasta `telegram-bot/` (ou o arquivo `chat_id.json`)
2. Rodar novamente: `node D:\chatpay\telegram-bot\get-chat-id.mjs`
3. Enviar `/start` para o bot no Telegram
4. O ID será impresso na tela e salvo automaticamente

## 🔄 Migração de Polling para Webhook

Quando quiser migrar de polling para webhook (mais eficiente, "push" ao invés de "poll"):

### **Passo 1: Obter informações atuais**
- Seus dados já estão em `telegram-bot/chat_id.json`
- Token está em `.env`

### **Passo 2: Configurar Webhook no BotFather**
1. No Telegram, converse com `@BotFather`
2. Envie: `/deletewebhook` (apaga webhook antigo)
3. Envie: `/setwebhook https://SEU-DOMINIO.workers.dev/api/telegram-webhook`
   - O domínio deve ser o seu domínio público no Cloudflare Workers

### **Passo 3: Atualizar o bot.mjs**
Substitua o loop de polling por validação de webhook:

```javascript
// Em bot.mjs, substitua o while(true) por:
// Após receber update via webhook, processar igual ao polling
// O endpoint /api/telegram-webhook no worker.js já está preparado
```

### **Vantagens do Webhook:**
- ✅ Mais eficiente (não precisa perguntar a cada 3s)
- ✅ Recebe atualizações em tempo real
- ✅ Melhor para produção

### **Desvantagens:**
- ⚠️ Precisa de domínio público
- ⚠️ Precisa configurar no BotFather
- ⚠️ Mais complexo de inicializar

## 🛠️ Solução de Problemas

| Problema | Solução |
|----------|---------|
| "Token inválido" | Verifique se o `.env` tem o token correto |
| "ETIMEDOUT" | Verifique sua conexão de internet |
| Bot não responde | Certifique-se de ter enviado `/start` primeiro |
| Comandos não funcionam | Verifique se o bot está rodando (`node bot.mjs`) |
| chat_id.json não cria | Certifique-se de ter enviado `/start` primeiro no Telegram |

## 📜 Licença

Este projeto está sob licença MIT. Sinta-se livre para usar e modificar.

---

**Desenvolvido com ❤️ para o projeto ChatPay**