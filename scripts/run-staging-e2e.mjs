#!/usr/bin/env node

const DEFAULT_BASE_URL = 'https://midas-core-staging.novoronaldo-m.workers.dev';
const baseUrl = String(process.env.CHATPAY_STAGING_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
const token = String(process.env.CHATPAY_TOKEN || '').trim();

function fail(message) {
  console.error(`E2E interrompido: ${message}`);
  process.exitCode = 1;
}

function safeJson(text) {
  try { return JSON.parse(text); } catch { return { error: 'resposta JSON inválida' }; }
}

async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(baseUrl + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(90_000)
  });
  const payload = safeJson(await response.text());
  return { response, payload };
}

if (!/^https:\/\//i.test(baseUrl)) {
  fail('CHATPAY_STAGING_URL precisa usar HTTPS.');
} else if (!token) {
  fail('defina CHATPAY_TOKEN localmente; não o cole no chat nem o grave no repositório.');
} else {
  try {
    const { response: statusResponse, payload: status } = await request('/api/sandbox-status');
    if (!statusResponse.ok) {
      fail(`status do Worker retornou HTTP ${statusResponse.status}; confira apenas os nomes em missingConfig.`);
    } else if (!status.sandboxMode || !status.externalHttpBlocked || !status.workersAiAllowed || !status.workersAiBindingConfigured || !status.configComplete || !status.sandboxReady) {
      fail(`pré-requisitos do sandbox não satisfeitos: ${JSON.stringify({ sandboxMode: status.sandboxMode, externalHttpBlocked: status.externalHttpBlocked, workersAiBindingConfigured: status.workersAiBindingConfigured, missingConfig: status.missingConfig })}`);
    } else if (status.e2eRunnerAvailable !== true) {
      fail('o Worker ainda não tem o runner E2E implantado.');
    } else if (status.workersAiMaxAttempts !== 1 || status.workersAiMaxTokens !== 256) {
      fail('os limites Workers AI do sandbox não correspondem à política esperada.');
    } else if (process.env.CHATPAY_CONFIRM_STAGING_REDIS !== 'YES') {
      fail('confirme primeiro que REDIS_URL aponta para Redis isolado de staging, definindo CHATPAY_CONFIRM_STAGING_REDIS=YES.');
    } else if (process.env.CHATPAY_CONFIRM_ZERO_COST !== 'YES') {
      fail('confirme no painel que não haverá excedente faturável, definindo CHATPAY_CONFIRM_ZERO_COST=YES.');
    } else {
      console.log('Executando E2E no Worker de staging: até 10 turnos sintéticos; Workers AI; sem envio externo ou cobrança Pix.');
      const { response: startResponse, payload: started } = await request('/api/sandbox-e2e', {
        method: 'POST',
        body: { action: 'start', token, maxTurns: 10, confirmStagingRedis: true, confirmZeroCost: true }
      });
      if (!startResponse.ok || started.status !== 'running' || !started.runId) {
        fail(`não foi possível iniciar o runner (HTTP ${startResponse.status}, ${started.error || 'resposta inesperada'}).`);
      } else {
        console.log(`Run ${started.runId}; limite de ${started.maxTurns} turnos e ${started.aiCallLimit} chamadas AI.`);
        let completed = false;
        for (let turnNumber = 1; turnNumber <= started.maxTurns; turnNumber += 1) {
          const { response: turnResponse, payload: turnResult } = await request('/api/sandbox-e2e', {
            method: 'POST',
            body: { action: 'turn', token, runId: started.runId, turn: turnNumber }
          });
          if (!turnResponse.ok || turnResult.status === 'aborted') {
            fail(`runner abortou após ${turnResult.turnsCompleted || 0} turnos; motivo=${turnResult.abortReason || turnResult.error || `HTTP ${turnResponse.status}`}.`);
            break;
          }
          const turn = turnResult.turn;
          if (!turn || !turn.customer || !turn.agent) {
            fail('o Worker não retornou um par cliente/agente completo; nenhum turno foi inventado pelo runner local.');
            break;
          }
          console.log(`\n--- Turno ${turn.turn}/${turnResult.maxTurns} ---`);
          console.log(`Cliente sintético [${turn.customerModel || 'Workers AI'}]: ${turn.customer}`);
          console.log(`Agentes ChatPay: ${turn.agent}`);
          console.log(`Chamadas AI neste turno: cliente=${turn.customerAiCalls}, agentes=${turn.agentAiCalls}; total=${turnResult.totalAiCalls}.`);
          if (turnResult.status === 'completed') {
            completed = true;
            console.log(`\nE2E concluído: ${turnResult.turnsCompleted} turnos reais no Worker de staging.`);
            break;
          }
        }
        if (!completed && process.exitCode !== 1) fail('o runner encerrou sem marcar a conversa como concluída.');
      }
    }
  } catch (error) {
    fail(`falha de transporte/execução (${error?.name || 'Error'}). Nenhum retry automático foi feito para evitar inferências duplicadas.`);
  }
}
