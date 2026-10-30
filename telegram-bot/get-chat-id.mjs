// Captura o Chat ID da primeira mensagem recebida usando long polling.
// Requer BOT_TOKEN no ambiente e não remove um webhook automaticamente.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BOT_TOKEN = (process.env.BOT_TOKEN || '').trim();
if (!BOT_TOKEN) {
  console.error('BOT_TOKEN não configurado. Defina a variável de ambiente antes de executar.');
  process.exit(1);
}

const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;
const OUTPUT_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'chat_id.json');

async function getUpdates(offset) {
  const query = new URLSearchParams({ offset: String(offset), timeout: '25' });
  const response = await fetch(`${API_BASE}/getUpdates?${query}`);
  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(result.description || `Telegram API HTTP ${response.status}`);
  }
  return result.result || [];
}

async function main() {
  console.log('Aguardando uma mensagem no bot. Envie /start no Telegram.');
  console.log('O script não altera webhooks; use um bot de desenvolvimento dedicado.');

  let offset = 0;
  while (true) {
    const updates = await getUpdates(offset);
    for (const update of updates) {
      offset = update.update_id + 1;
      const message = update.message;
      if (!message?.chat?.id) continue;

      const record = {
        chatId: message.chat.id,
        firstName: message.from?.first_name || message.chat.first_name || 'Unknown',
        username: message.from?.username || '',
        receivedAt: new Date().toISOString()
      };
      fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
      console.log(`Chat ID capturado e salvo em ${OUTPUT_PATH}.`);
      return;
    }
  }
}

main().catch(error => {
  console.error('Não foi possível obter o Chat ID:', error.message);
  process.exitCode = 1;
});
