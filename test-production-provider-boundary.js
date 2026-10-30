import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const source = fs.readFileSync(new URL('./worker.js', import.meta.url), 'utf8');
const forbidden = ['OPENROUTER_API_KEY', 'GEMINI_API_KEY', 'GROQ_API_KEY', 'openrouter.ai', 'generativelanguage.googleapis.com', 'api.groq.com'];
for (const marker of forbidden) assert.equal(source.includes(marker), false, `produção sem providers de laboratório: ${marker}`);
assert.match(source, /env\.AI\.run/);
assert.match(source, /text\.pollinations\.ai/);
assert.match(source, /CONFIG\.redisToken/);
assert.match(source, /CONFIG\.midasSecret/);
const workspace = path.dirname(fileURLToPath(import.meta.url));
const forbiddenFiles = [];
const envName = ['.', 'env'].join('');
const localEnvName = [envName, '.local'].join('');
function scan(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.wrangler') continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) scan(fullPath);
    else if (entry.name === envName || entry.name === localEnvName || entry.name.endsWith('.pem') || /secret.*\.json$/i.test(entry.name)) forbiddenFiles.push(fullPath);
  }
}
scan(workspace);
assert.deepEqual(forbiddenFiles, [], 'nenhum arquivo de segredo existe no workspace');

const telegramTokenPattern = /\b\d{8,12}:[A-Za-z0-9_-]{30,}\b/g;
const exposedTelegramTokens = [];
function scanTextForTelegramTokens(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.wrangler') continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      scanTextForTelegramTokens(fullPath);
      continue;
    }
    let text;
    try { text = fs.readFileSync(fullPath, 'utf8'); } catch (_) { continue; }
    for (const [index, line] of text.split(/\r?\n/).entries()) {
      if (telegramTokenPattern.test(line)) exposedTelegramTokens.push(`${path.relative(workspace, fullPath)}:${index + 1}`);
      telegramTokenPattern.lastIndex = 0;
    }
  }
}
scanTextForTelegramTokens(workspace);
assert.deepEqual(exposedTelegramTokens, [], 'nenhum token Telegram em texto puro no workspace');
console.log('produção sem providers de laboratório nem token Telegram em texto puro: passed');
