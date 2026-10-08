// == CHAT PAY: Bot Telegram Principal ==
// Autor: Configuração ChatPay
// Descrição: Bot Telegram com polling, comandos e envio de mensagens
// Dependências: ZERO (apenas fetch nativo e fs)

// === 1. Importações e carregamento de config ===
const fs = require('fs');
const path = require('path');

// Carregar token do .env (Node 18+ com experimental modulators ou process.env)
const env = {
  BOT_TOKEN: process.env.BOT_TOKEN || '8683827538:AAEGG7F0-b9wPCj-F3fEzKaf-4P5RyidImA'
};

// Carregar chat_id salvo anteriormente
let savedChatId = null;
const chatIdPath = path.join('.', 'telegram-bot', 'chat_id.json');

if (fs.existsSync(chatIdPath)) {
  try {
    const data = JSON.parse(fs.readFileSync(chatIdPath, 'utf8'));
    savedChatId = data.chatId;
    console.log('📦 Chat ID carregado do arquivo:', savedChatId);
  } catch (e) {
    console.log('⚠️ Erro ao ler chat_id.json, começando do zero:', e.message);
  }
}

// === 2. Função deletar webhook ao iniciar ===
async function deleteWebhook() {
  try {
    const resp = await fetch(`https://api.telegram.org/bot${savedChatId || TOKEN}/deleteWebhook`, {
      method: 'POST'
    });
    const result = await resp.json();
    console.log('✅ Webhook deletado (polling ativo)');
    return result;
  } catch (err) {
    console.log('⚠️ Erro ao deletar webhook:', err.message);
    return null;
  }
}

// === 3. Função de envio de mensagem ===
async function sendMessage(chat_id, text) {
  try {
    await fetch(
      `https://api.telegram.org/bot${TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id, text })
      }
    );
    // console.log(`📨 Mensagem enviada para ${chat_id}: ${text}`);
  } catch (err) {
    console.error('❌ Erro ao enviar mensagem:', err.message);
  }
}

// === 4. Função de polling (long getUpdates) ===
async function getUpdates(offset = null) {
  const url = offset !== null
    ? `https://api.telegram.org/bot${TOKEN}/getUpdates?offset=${offset}`
    : `https://api.telegram.org/bot${TOKEN}/getUpdates`;

  try {
    const response = await fetch(url);
    return await response.json();
  } catch (err) {
    console.error('❌ Erro ao buscar updates:', err.message);
    return { ok: false, result: [] };
  }
}

// === 5. Normalizar mensagem recebida ===
function normalizeMessage(message) {
  if (!message || !message.text) return null;

  const text = message.text.trim();
  const chat = message.chat;
  return {
    text: text,
    chatId: chat.id,
    firstName: chat.first_name || 'Unknown',
    username: chat.username || 'Sem username',
    isCommand: text.startsWith('/')
  };
}

// === 6. Loop principal do bot ===
async function main() {
  console.log('🤖 Bot Telegram iniciado!');
  console.log('📡 Modo: Long Polling (getUpdates)');
  console.log('');

  let lastOffset = 0;
  let myChatId = savedChatId; // Começa com o salvo ou null

  // Loop infinito de polling
  while (true) {
    try {
      const data = await getUpdates(lastOffset);

      if (data.ok && data.result && data.result.length > 0) {
        for (const update of data.result) {
          lastOffset = update.update_id + 1;
          const normalized = normalizeMessage(update.message);

          if (!normalized) continue;

          myChatId = normalized.chatId;

          // Comandar handler
          switch (normalized.text) {
            case '/start':
              // Boas-vindas + salvar/atualizar chat_id
              const welcomeMsg = `👋 Olá, ${normalized.firstName}! Seja bem-vindo ao ChatPay Bot.\n\n🔢 Seu Chat ID é: \`${normalized.chatId}\`\nUse /id para confirmar.`;

              await sendMessage(normalized.chatId, welcomeMsg);

              // Salvar/atualizar chat_id.json
              const chatData = {
                chatId: normalized.chatId,
                firstName: normalized.firstName,
                username: normalized.username || 'Sem username',
                receivedAt: new Date().toISOString()
              };
              fs.writeFileSync(
                path.join('.', 'telegram-bot', 'chat_id.json'),
                JSON.stringify(chatData, null, 2)
              );
              console.log('💾 chat_id.json atualizado com conversa atual');

              // Responder no Telegram
              await sendMessage(normalized.chatId, welcomeMsg);
              break;

            case '/id':
              // Responder o chat id da conversa
              const idReply = `🆔 Seu Chat ID é:\n\`${normalized.chatId}\`\n\nNome: ${normalized.firstName}\nUsername: @${normalized.username || 'N/A'}`;
              await sendMessage(normalized.chatId, idReply);
              console.log('📤 Respondeu /id para:', normalized.chatId);
              break;

            default:
              // Comandos não reconhecidos
              await sendMessage(normalized.chatId, '⚠️ Comando não reconhecido. Use /start ou /id.');
              console.log('❓ Comando desconhecido:', normalized.text);
              break;
          }
        }
      }

      // Atualizar offset para o próximo update
      if (data.result && data.result.length > 0) {
        lastOffset = data.result[data.result.length - 1].update_id + 1;
      }

    } catch (err) {
      console.error('❌ Erro no loop principal:', err.message);
      // Não derrubar o loop - apenas esperar próxima iteração
    }

    // Long polling: esperar 3 segundos entre cada verificação
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
}

// === 6. Execução ===
// Verificar se temos token
if (!TOKEN || TOKEN === '') {
  console.error('❌ Token do bot não encontrado! Verifique o .env');
  process.exit(1);
}

// Iniciar bot
main().catch(err => {
  console.error('❌ Erro ao iniciar bot:', err);
  process.exit(1);
});