/**
 * Debug do chunkText para entender o comportamento
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Simula a função chunkText do worker.js
function chunkText(text, size = 800, overlap = 100) {
  const src = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!src) return [];
  const windowChunks = (s) => {
    const step = Math.max(1, size - overlap);
    const chunks = [];
    for (let i = 0; i < s.length; i += step) {
      const slice = s.slice(i, i + size).trim();
      if (slice) chunks.push(slice);
      if (i + size >= s.length) break;
    }
    return chunks;
  };
  if (!/^#{2,3}\s/m.test(src)) return windowChunks(src);
  const lines = src.split('\n');
  if (lines.some(l => /^###\s/.test(l))) {
    // Doc com subseções: só ### viram chunk (seções ## sem ### são meta/sistema e ficam de fora)
    const out = [];
    let parent = '';
    let cur = [];
    const flush = () => {
      if (!cur.length) return;
      const body = cur.join('\n').trim();
      cur = [];
      if (!body) return;
      // Extrair apenas a resposta real (remover metadados como "Gatilhos:", "Mafel:")
      const cleanBody = body
        .replace(/^Gatilhos:.*$/m, '') // Remove linha "Gatilhos: ..."
        .replace(/^Mafel:\s*/m, '') // Remove prefixo "Mafel: "
        .replace(/^###\s+.+$/m, '') // Remove cabeçalho ###
        .replace(/^##\s+.+$/m, '') // Remove cabeçalho ##
        .trim();
      if (!cleanBody) return;
      // IMPORTANTE: NÃO incluir parent (##) no chunk final - é só contexto para embedding
      // A resposta do cliente deve ser limpa, sem cabeçalhos
      if (cleanBody.length <= size) out.push(cleanBody);
      else out.push(...windowChunks(cleanBody));
    };
    for (const ln of lines) {
      if (/^##\s/.test(ln)) { flush(); parent = ln.trim(); }
      else if (/^###\s/.test(ln)) { flush(); cur = [ln]; }
      else if (cur.length) cur.push(ln);
    }
    flush();
    if (out.length) return out;
  }
  const sections = [];
  let cur = [];
  for (const ln of lines) {
    if (/^#{2,3}\s/.test(ln) && cur.length) {
      sections.push(cur.join('\n').trim());
      cur = [ln];
    } else {
      cur.push(ln);
    }
  }
  if (cur.length) sections.push(cur.join('\n').trim());
  const out = [];
  for (const sec of sections) {
    if (!sec) continue;
    // Limpar metadados das seções também
    const cleanSec = sec
      .replace(/^Gatilhos:.*$/m, '')
      .replace(/^Mafel:\s*/m, '')
      .replace(/^#{2,3}\s+.+$/m, '')
      .trim();
    if (!cleanSec) continue;
    if (cleanSec.length <= size) out.push(cleanSec);
    else out.push(...windowChunks(cleanSec));
  }
  return out;
}

// Teste do caso que está falhando
const doc = '# Titulo\nintro\n## Curta\ntexto curto da secao\n## Grande\n' + 'x'.repeat(1000) + '\n### Sub\nsubsecao importante';
console.log('DOC:');
console.log(doc);
console.log('\n---\n');

const ch = chunkText(doc, 800, 100);
console.log('CHUNKS:', ch.length);
console.log('\nCHUNK 0:');
console.log(ch[0]);
console.log('\nVERIFICAÇÕES:');
console.log('Tem ##:', ch[0].includes('##'));
console.log('Tem ###:', ch[0].includes('###'));
console.log('Tem "subsecao importante":', ch[0].includes('subsecao importante'));
