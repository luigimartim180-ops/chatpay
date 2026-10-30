// Bot Telegram simples para desenvolvimento local.
// O token deve ser fornecido por BOT_TOKEN no ambiente; nunca o grave no código.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BOT_TOKEN = (process.env.BOT_TOKEN || '').trim();
if (!BOT_TOKEN) {
  console.error('BOT_TOKEN não configurado. Defina a variável de ambiente antes de iniciar o bot.');
  process.exit(1);
}

const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;
const CHAT_ID_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'chat_id.json');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

let savedChatId = null;
try {
  if (fs.existsSync(CHAT_ID_PATH)) {
    savedChatId = JSON.parse(fs.readFileSync(CHAT_ID_PATH, 'utf8')).chatId ?? null;
    if (savedChatId !== null) console.log('Chat ID local carregado.');
  }
} catch (error) {
  console.warn('Não foi possível ler chat_id.json:', error.message);
}

async function telegram(method, options = {}) {
  const response = await fetch(`${API_BASE}/${method}`, options);
  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(result.description || `Telegram API HTTP ${response.status}`);
  }
  return result.result;
}

async function sendMessage(chatId, text) {
  await telegram('sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  });
}

async function getUpdates(offset) {
  const query = new URLSearchParams({ offset: String(offset), timeout: '25' });
  return telegram(`getUpdates?${query}`);
}

function saveChatId(message) {
  const chat = message.chat || {};
  const from = message.from || {};
  const record = {
    chatId: chat.id,
    firstName: from.first_name || chat.first_name || 'Unknown',
    username: from.username || '',
    receivedAt: new Date().toISOString()
  };
  fs.writeFileSync(CHAT_ID_PATH, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
  savedChatId = record.chatId;
  return record;
}

async function main() {
  console.log('Bot Telegram iniciado em long polling.');
  console.log('Use um bot de desenvolvimento dedicado; este processo não altera webhooks.');

  let offset = 0;
  while (true) {
    try {
      const updates = await getUpdates(offset);
      for (const update of updates) {
        offset = update.update_id + 1;
        const message = update.message;
        if (!message?.text || message.chat?.id === undefined) continue;

        const chatId = message.chat.id;
        const command = message.text.trim().split(/\s+/, 1)[0].split('@', 1)[0].toLowerCase();

        if (command === '/start') {
          const record = saveChatId(message);
          await sendMessage(chatId, `Olá, ${record.firstName}! Bot ativo. Seu Chat ID é ${record.chatId}.`);
        } else if (command === '/id') {
          await sendMessage(chatId, `Seu Chat ID é ${chatId}.`);
        } else {
          await sendMessage(chatId, 'Comando não reconhecido. Use /start ou /id.');
        }
      }
    } catch (error) {
      console.error('Falha no polling do Telegram:', error.message);
      await sleep(3000);
    }
  }
}

main().catch(error => {
  console.error('Falha ao iniciar o bot:', error.message);
  process.exitCode = 1;
});
