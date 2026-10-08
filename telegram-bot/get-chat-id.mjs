// == CHAT PAY: Obter Chat ID via Polling ==
// Autor: Configuração automática ChatPay
// Descrição: Polling simples para capturar o Chat ID do Telegram
// Dependências: ZERO (apenas fetch nativo do Node 18+)

// === 1. Token do Bot (definido diretamente) ===
const TOKEN = '8683827538:AAEGG7F0-b9wPCj-F3fEzKaf-4P5RyidImA';

// === 2. Função deletar webhook (limpa webhook preso que esvazia o getUpdates) ===
async function deleteWebhook() {
  try {
    await fetch(`https://api.telegram.org/bot${TOKEN}/deleteWebhook`, {
      method: 'POST'
    });
    console.log('✅ Webhook deletado (limpo para polling)');
  } catch (err) {
    console.log('⚠️ Erro ao deletar webhook (pode ignorar):', err.message);
  }
}

// === 3. Função principal de polling ===
async function main() {
  console.log('🔄 Iniciando polling do Telegram...');
  console.log('📡 Aguardando mensagem do bot...');
  console.log('');

  let lastUpdateId = 0;

  // Polling a cada 3 segundos
  const intervalId = setInterval(async () => {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${TOKEN}/getUpdates?offset=${lastUpdateId + 1}`
      );

      const data = await response.json();

      if (data.ok && data.result && data.result.length > 0) {
        for (const message of data.result) {
          lastUpdateId = message.update_id;

          // Extrair dados do message
          const chat = message.message.chat;
          const from = message.message.from;

          const chatId = chat.id;
          const firstName = chat.first_name || 'Unknown';
          const username = chat.username || 'Sem username';

          // Imprimir o Chat ID na tela
          console.log('🔔 PRIMEIRA MENSAGEM RECEBIDA!');
          console.log('📋 CHAT ID =', chatId);
          console.log('👤 First Name:', firstName);
          console.log('💼 Username:', username);
          console.log('');

          // Salvar em chat_id.json
          const chatData = {
            chatId: chatId,
            firstName: firstName,
            username: username,
            receivedAt: new Date().toISOString(),
            messageText: message.message.text || 'N/A'
          };

          const fs = require('fs');
          fs.writeFileSync('telegram-bot/chat_id.json', JSON.stringify(chatData, null, 2));

          console.log('💾 Chat ID salvo em: telegram-bot/chat_id.json');
          console.log('');

          // Encerrar após salvar
          clearInterval(intervalId);
          console.log('✅ Finalizado. O Chat ID foi capturado e salvo.');
          process.exit(0);
        }
      }
    } catch (error) {
      console.error('❌ Erro no polling:', error.message);
    }
  }, 3000);
}

// Executar main
main().catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});