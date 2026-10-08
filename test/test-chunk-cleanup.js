/**
 * Teste unitário para verificação de limpeza de metadados no chunkText
 * Verifica se cabeçalhos, "Gatilhos" e "Mafel" são removidos corretamente
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
      const withParent = parent && !cleanBody.startsWith(parent) ? parent + '\n' + cleanBody : cleanBody;
      if (withParent.length <= size) out.push(withParent);
      else out.push(...windowChunks(withParent));
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

// Teste com o exemplo do MAFEL-KB.md seção 5.11
const sampleSection = `### 5.11 "está caro"
Gatilhos: caro, desconto, ta salgado, não tenho dinheiro agora
Mafel: "Entendo. Pensa comigo: quanto vale aquele cliente que chamou 22h e ficou sem resposta? Uma venda perdida costuma custar mais que o mês inteiro do ChatPay — e com a garantia de 7 dias, o teste não te custa nada. Se o aperto for de caixa agora, o cartão em 12x resolve: fica menos que um café por dia."`;

console.log('=== TESTE DE LIMPEZA DE METADADOS ===\n');
console.log('Input (bruto):');
console.log(sampleSection);
console.log('\n---\n');

const chunks = chunkText(sampleSection);
console.log('Chunks gerados:', chunks.length);
console.log('\nChunk limpo:');
console.log(chunks[0]);

// Verificações
const hasGatilhos = chunks[0].includes('Gatilhos');
const hasMafel = chunks[0].includes('Mafel:');
const hasHeader = chunks[0].includes('5.11');
const hasResponse = chunks[0].includes('Entendo. Pensa comigo');

console.log('\n=== VERIFICAÇÕES ===');
console.log('✅ Removeu "Gatilhos":', !hasGatilhos);
console.log('✅ Removeu "Mafel:":', !hasMafel);
console.log('✅ Removeu cabeçalho "5.11":', !hasHeader);
console.log('✅ Mantém resposta real:', hasResponse);

if (!hasGatilhos && !hasMafel && !hasHeader && hasResponse) {
  console.log('\n✅ TESTE PASS - Metadados removidos corretamente');
} else {
  console.log('\n❌ TESTE FAIL - Metadados ainda presentes');
  process.exit(1);
}
