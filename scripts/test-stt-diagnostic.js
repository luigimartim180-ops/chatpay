/**
 * Script de diagnóstico para STT (Speech-to-Text) no Telegram
 * 
 * Objetivo: entender onde o fluxo de áudio está falhando em produção
 * conforme relatado em HANDOFF-REVISOR.md §4.1
 * 
 * Uso: node scripts/test-stt-diagnostic.js
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Simula o fluxo de áudio do worker.js
async function testTelegramAudioFlow() {
  console.log('=== Diagnóstico STT Telegram ===\n');
  
  // 1. Verificar se consegue fazer getFile no Telegram
  console.log('PASSO 1: Testar getFile no Telegram');
  console.log('Requer: botToken válido + file_id real de áudio');
  console.log('Status: ⚠️  Necessário teste em produção (chat 998009360)');
  console.log('Comando manual: curl "https://api.telegram.org/bot<TOKEN>/getFile?file_id=<ID>"\n');
  
  // 2. Verificar se consegue baixar o arquivo
  console.log('PASSO 2: Testar download do arquivo');
  console.log('Após getFile, tenta: https://api.telegram.org/file/bot<TOKEN>/<file_path>');
  console.log('Erros possíveis: 404 (arquivo expirou), 403 (sem permissão), timeout\n');
  
  // 3. Verificar conversão base64
  console.log('PASSO 3: Conversão base64');
  console.log('Worker.js usa loop manual de 8192 bytes (line 2871-2876)');
  console.log('Formato esperado: base64 puro, sem data URI\n');
  
  // 4. Verificar Workers AI / Whisper
  console.log('PASSO 4: TranscribeTelegramAudio (worker.js:695)');
  console.log('Modelos tentados (ordem):');
  console.log('  1. @cf/openai/whisper-large-v3-turbo');
  console.log('  2. @cf/openai/whisper');
  console.log('Formato: { audio: b64, language: "pt", task: "transcribe" }');
  console.log('Fallback: mensagens format (audio input_audio)\n');
  
  // 5. Verificar logging atual
  console.log('PASSO 5: Logging existente');
  console.log('tg_voice_transcribed (line 2884): só chama se transcript existe');
  console.log('⚠️  NÃO há log de falha no catch (line 2879) - problema!');
  console.log('⚠️  NÃO há métrica de falha de STT (tg:metric:audio:{dia} existe mas não usada)\n');
  
  // 6. Recomendações
  console.log('=== RECOMENDAÇÕES ===\n');
  console.log('1. Adicionar logging detalhado no catch (line 2879):');
  console.log('   catch (err) {');
  console.log('     await log("tg_stt_error", { chat_id: chatId, step: "getFile|download|transcribe", error: String(err) });');
  console.log('     transcript = "";');
  console.log('   }');
  console.log('');
  console.log('2. Adicionar métrica de falha:');
  console.log('   await redis("INCR", "tg:metric:audio_failed:" + new Date().toISOString().slice(0,10));');
  console.log('');
  console.log('3. Teste manual em produção:');
  console.log('   - Enviar áudio real no chat 998009360');
  console.log('   - Verificar logs do worker (Cloudflare Dashboard)');
  console.log('   - Verificar se getFile retorna 200');
  console.log('   - Verificar se Workers AI retorna erro específico\n');
  
  console.log('=== LIMITAÇÕES ATUAIS ===\n');
  console.log('- Testes unitários (test-phase3-kb.js:331) só cobrem caminho de FALHA');
  console.log('- Harness faults.aiRunner simula sucesso, não testa Workers AI real');
  console.log('- smoke-live.js S1 manda arquivo inexistente → espera audio_failed');
  console.log('- NENHUM teste valida sucesso do STT em produção\n');
  
  console.log('=== PRÓXIMA AÇÃO ===\n');
  console.log('Sugestão: Adicionar logging no worker e fazer teste manual com áudio real');
  console.log('Arquivo: worker.js line 2863-2889 (bloco de áudio)');
  console.log('Chat teste: 998009360 (@ChatPayteste_bot)');
}

testTelegramAudioFlow().catch(console.error);
