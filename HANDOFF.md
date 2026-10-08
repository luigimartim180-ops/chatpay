# HANDOFF.md — ChatPay ITEMS 4 & 5 (Pricing Dashboard + Voice AI)

## 1) Objetivo Final da Tarefa

Implementar **Pricing Transparente no Dashboard** (ITEM 4) e **Voice AI Vapi/Bland** (ITEM 5).

**ITEM 4 - Pricing Dashboard:**
- **Tokens usados** (hoje/semana/mes) por modelo
- **Custo real LLM em R$** (convertido pela cotacao R$5.50/USD)
- **Agents executados** (contador `agent:runs:{dom}`)
- **Alertas visuais**: "80% quota tokens" + "Custo > 15% receita" (cost guard)
- Endpoint **`/api/usage-metrics`** servindo dados em tempo real (JWT auth)
- Card Dashboard com 6 metricas + tabela por provedor + agents + badges de alerta

**ITEM 5 - Voice AI (Vapi/Bland):**
- Classes `VapiIntegration` (getCallStatus, endCall, getTranscript, estimateCost) + `BlandIntegration` (getCallStatus, endCall, getTranscript) + `routeCall` (priority routing) inline em `worker.js`
- Endpoints: `POST /api/voice/call`, `GET /api/voice/calls`, `GET /api/voice/call/{id}`, `POST /api/voice/config`
- Credenciais salvas via Redis (`cfg:{dom}:integrations`) + env vars (wrangler secrets)
- Card Voice AI no dashboard: formulario de credenciais + iniciar ligacao
- Metricas: `swarm:voice:metrics:{dom}:{dayKey}` (calls, cost_estimated) + `swarm:voice:calls:{dom}` (recent calls)
- Voice cost integrado ao `/api/usage-metrics` (field `voice`)

Criterio de aceite: `predeploy-check.ps1` PASS 100% + smoke ao vivo 10/10 + 12 personas 17/17.

---

## 2) Decisões Técnicas Já Tomadas e Motivo

| Decisão | Motivo |
|---------|--------|
| **Nova key Redis `swarm:llm:usage:{dom}`** (hash diário) | Evita colisão com `swarm:usage:{dom}:{hour}` do **guardian** (rate-limit por hora). O `guardian` usa `swarm:usage:{dom}:YYYY-MM-DDTHH` como STRING (contador simples). O tracking de LLM precisa ser HASH com campos `tokens_in`, `tokens_out`, `cost_r$`, `calls` por dia. |
| **Cotação fixa R$5.50/USD** | Alinhado com `scripts/llm-providers.js` (`estimateDeepSeekCostBrl`) e documentado em `PLANO-MESTRE-CHATPAY-v2.md` §75-99. |
| **Rates BRL em `LLM_COST_RATES`** | Calcular custo no worker sem depender de API externa. Workers AI = 0 (grátis no Cloudflare). |
| **Cost guard threshold = 15% da receita** | Regra de negócio do ChatPay (meta: custo LLM < 15% ticket). Implementado no `qualifyLead` (`swarm:budget` vs `precoGuard * 0.15`). Reutilizar mesma lógica no dashboard. |
| **Endpoint `/api/usage-metrics` autenticado via JWT token** | Consistente com `/api/me`, `/api/hunter-analytics-v2`, `/api/swarm-config`. |
| **Dashboard card em `dashPage()` (JS inline)** | Arquitetura atual: HTML/JS dentro de `worker.js` (~linha 2783). Não há build step nem frontend separado. |
| **Reutilizar `agentRun` (`agent:runs:{dom}`) + `swarm:txlog` (receita) + `swarm:budget:{dom}:{day}` (chamadas DeepSeek)** | Fontes de verdade já existentes. Não criar novas keys desnecessárias. |

---

## 3) Arquivos Já Criados/Alterados (Caminhos Exatos)

### 3.1 `worker.js` — **Parcialmente implementado (scaffolding)**

| Linha | Conteúdo | Status |
|-------|----------|--------|
| 1325-1328 | `LLM_COST_RATES` — **Rates OpenAI incorretos** (`0.000003 / 1e6 * 5.5` deveria ser `$3/1M = 3/1e6 * 5.5`) | ⚠️ Precisa correção |
| 1330-1341 | `trackLlmUsage(dom, provider, promptTokens, replyTokens, costR$)` — **Usa `swarm:usage:{dom}` que COLIDE com guardian** | ❌ Precisa redesign → `swarm:llm:usage:{dom}` |
| 1351-1417 | `callLLM` — providers `deepseek_chat`, `deepseek_reasoner`, `openai`, `anthropic`, `custom`, `workers_ai` | ✅ Providers funcionam |
| 1398-1416 | DeepSeek branches — **não chamam `trackLlmUsage`** | ❌ Falta integração |
| 1351-1366 | OpenAI branch — **não chama `trackLlmUsage`** | ❌ Falta integração |
| 1368-1383 | Anthropic branch — **não chama `trackLlmUsage`** | ❌ Falta integração |
| 1385-1396 | Custom branch — **não chama `trackLlmUsage`** | ❌ Falta integração |
| 1418 | Fallback `llm(prompt, env)` (Workers AI) — **não chama `trackLlmUsage`** | ❌ Falta integração (Workers AI = custo 0) |
| 2783+ | `dashPage()` — **sem card de Usage Metrics** | ❌ Precisa criar |
| 3127+ | Router — **sem `/api/usage-metrics`** | ❌ Precisa criar endpoint |

### 3.2 `scripts/llm-providers.js` — **Referência de rates (já correto)**

- `DEEPSEEK_CONFIG.chat.costIn = 0.14`, `costOut = 0.28` (por 1M tokens)
- `DEEPSEEK_CONFIG.reasoner.costIn = 0.55`, `costOut = 2.19`
- `estimateDeepSeekCostBrl(usage)` → retorna `{ cost_r$: Number }` (usa 5.50 fixo)

### 3.3 `scripts/secret-loader.js` — **DEEPSEEK_API_KEY adicionado** ✅

### 3.4 `test/harness.js` — **Suporta `HINCRBY`, `HINCRBYFLOAT`, `SETEX`** ✅

### 3.5 `test/test-v23.js` — **Testes SDR C2.1-C2.4 (44/44 PASS)** ✅

### 3.6 `docs/PLANO-MESTRE-CHATPAY-v2.md` — **ITEM 4 definido (§243-257)** ✅

### 3.7 `AGENTS.md` — **§1.12 (DeepSeek) + §1.13 (SDR) + §1.14 (Pricing Transparente) concluídos** ✅

---

## 4) To-Dos Pendentes (Em Ordem de Execução)

### 🔴 CRÍTICO — Backend Tracking (antes do endpoint/dashboard)

| # | Task | Arquivo | Detalhe | Status |
|---|------|---------|---------|--------|
| 1 | **Corrigir `LLM_COST_RATES`** | `worker.js:1325-1328` | OpenAI: `in: 3/1e6*5.5`, `out: 6/1e6*5.5` (GPT-4o-mini pricing). DeepSeek já ok (vindo do `llm-providers.js`). Anthropic: `in: 0.25/1e6*5.5`, `out: 1.25/1e6*5.5` (Claude 3 Haiku). Workers AI = 0. | ✅ CONCLUÍDO |
| 2 | **Redesenhar `trackLlmUsage` para keys não-colidentes** | `worker.js:1330-1341` | Nova key: `swarm:llm:usage:{dom}` (hash acumulado) + `swarm:llm:usage:{dom}:{dayKey}` (hash diário). Campos: `tokens_in`, `tokens_out`, `cost_r$`, `calls`, `tokens_{provider}`, `cost_{provider}`, `last_call_at`. Remover escrita em `swarm:usage:{dom}`. | ✅ CONCLUÍDO |
| 3 | **Integrar `trackLlmUsage` em TODOS os branches do `callLLM`** | `worker.js:1351-1418` | Extrair `usage.prompt_tokens` / `usage.completion_tokens` de cada resposta de API. Calcular `costR$` via `LLM_COST_RATES[provider]`. Chamar `await trackLlmUsage(pb.dom, provider, promptTokens, replyTokens, costR$)`. Workers AI → `costR$ = 0`. | ✅ CONCLUÍDO |
| 4 | **Criar endpoint `/api/usage-metrics`** | `worker.js` (router ~3127+) | `GET /api/usage-metrics?token=...` → retorna JSON: `{ domain, today: { tokens_in, tokens_out, cost_r$, calls, by_provider: {...} }, week: {...}, month: {...}, agents: { agentName: runs }, revenue_cents: totalRevenue (swarm:txlog), budget_used: swarm:budget:{dom}:{day}, alerts: [{ type: 'quota_80'|'cost_15pct', message, severity }] }`. | ✅ CONCLUÍDO |
| 5 | **Testes unitários `/api/usage-metrics`** | `test/test-v23.js` | Adicionar suite C3.x (C3.1 endpoint retorna dados, C3.2 alerta quota 80%, C3.3 alerta cost >15% receita). Usar `harness.js` MiniRedis. | ✅ CONCLUÍDO |

### 🟡 IMPORTANTE — Dashboard Frontend

| # | Task | Arquivo | Detalhe | Status |
|---|------|---------|---------|--------|
| 6 | **Adicionar card "💰 Uso & Custos LLM" no `dashPage()`** | `worker.js:2783+` | HTML: grid com 4 métricas (Hoje/Semana/Mês: tokens, custo R$, calls). Tabela `by_provider`. Lista `agents executed`. Badges de alerta (🟡 80% quota, 🔴 >15% receita). JS: `async function loadUsageMetrics()` chamada no `load()`. | ✅ CONCLUÍDO |
| 7 | **Estilo CSS inline no card** | `worker.js:2786` (style block) | Reutilizar classes `.card`, `.grid`, `.row`, cores `#F6C945` (amarelo), `#2ECC71` (verde), `#FF6B6B` (vermelho). | ✅ CONCLUÍDO |

### 🟢 VALIDAÇÃO — Gates de Deploy

| # | Task | Comando | Status |
|---|------|---------|--------|
| 8 | `node --check worker.js` | Sintaxe OK | ✅ CONCLUÍDO |
| 9 | `predeploy-check.ps1` | 100% PASS (todas suítes: phase1-4, v23 44/44, v22.x, demo, sim) | ✅ CONCLUÍDO |
| 10 | Deploy → `postdeploy-smoke.ps1` 6/6 | | ✅ CONCLUÍDO (deploy `dad07be-f4ee-43c1-b25b-d21e0de00274`, postdeploy 6/6) |
| 11 | `security-audit.ps1` 31/31 | | ✅ CONCLUÍDO (31/31 PASS) |
| 12 | Smoke ao vivo 10/10 (chat 998009360) | | ✅ CONCLUÍDO (10/10 PASS) |
| 13 | 12 personas 17/17 | | ✅ CONCLUÍDO (17/17 PASS) |
| 14 | Atualizar `AGENTS.md` §2 ITEM 4 → ✅ CONCLUÍDO + evidências | | ✅ CONCLUÍDO |

### 🔵 ITEM 5 — Voice AI (VAPI/BLAND) — ✅ CONCLUÍDO

| # | Task | Arquivo | Detalhe | Status |
|---|------|---------|---------|--------|
| 15 | **Aprimorar `VapiIntegration`** | `src/integrations/voice/vapi-integration.js` | Adicionar `getCallStatus`, `endCall`, `getTranscript`, `estimateCost` (dinâmico via `/cost` API) | ✅ CONCLUÍDO |
| 16 | **Aprimorar `BlandIntegration`** | `src/integrations/voice/bland-integration.js` | Adicionar `getCallStatus`, `endCall`, `getTranscript`, metadata, `wait_module: 'dynamic_v2'` | ✅ CONCLUÍDO |
| 17 | **Adicionar secrets ao `secret-loader.js`** | `scripts/secret-loader.js` | `VAPI_API_KEY`, `VAPI_ASSISTANT_ID`, `BLAND_API_KEY`, `BLAND_PATH_ID` | ✅ CONCLUÍDO |
| 18 | **Inlinar classes + `routeCall` em `worker.js`** | `worker.js` (após `trackLlmUsage`) | Worker é arquivo único (sem build step) — classes scaffold não são importadas | ✅ CONCLUÍDO |
| 19 | **Criar `POST /api/voice/call`** | `worker.js` | JWT auth + `routeCall` (priority: vapi → bland) + Redis logs + `trackLlmUsage` voice cost | ✅ CONCLUÍDO |
| 20 | **Criar `GET /api/voice/calls` e `GET /api/voice/call/{id}`** | `worker.js` | Lista chamadas recentes + status live do provider | ✅ CONCLUÍDO |
| 21 | **Criar `POST /api/voice/config`** | `worker.js` | Salva credenciais em `cfg:{dom}:integrations` (`vapi_api_key`, `vapi_assistant_id`, `bland_api_key`, `bland_path_id`) | ✅ CONCLUÍDO |
| 22 | **Card "🎙️ Voice AI" no `dashPage()`** | `worker.js` | Formulário credenciais Vapi/Bland + telefone + idioma + botão iniciar ligação | ✅ CONCLUÍDO |
| 23 | **JS inline `saveVoiceConfig()` / `initiateVoiceCall()`** | `worker.js` (`dashPage()` script) | Salvam credenciais via `/api/voice/config`; iniciam chamada via `/api/voice/call` | ✅ CONCLUÍDO |
| 24 | **Integrar voice em `/api/usage-metrics`** | `worker.js` | Campo `voice: { calls_today, cost_estimated_r$ }` | ✅ CONCLUÍDO |
| 25 | **`loadUsageMetrics()` exibe voice metrics** | `worker.js` | `voice-metrics` div: "Chamadas hoje: N \| Custo estimado: R$ X" | ✅ CONCLUÍDO |
| 26 | **`node --check worker.js` + 3 arquivos voice** | Todos | Sintaxe OK | ✅ CONCLUÍDO |
| 27 | **`predeploy-check.ps1` 100% PASS** | `scripts/predeploy-check.ps1` | 549 testes verdes | ✅ CONCLUÍDO |

### ⏳ Pendente para Voice AI (requer credenciais reais — free tier do usuário)

| # | Task | Como | Status |
|---|------|------|--------|
| 28 | **Setar secrets no wrangler** | `npx wrangler secret put VAPI_API_KEY` (idem `VAPI_ASSISTANT_ID`, `BLAND_API_KEY`, `BLAND_PATH_ID`) | ⏳ AGUARDA USUÁRIO |
| 29 | **Deploy com voice** | `npx wrangler deploy --name midas-core` | ⏳ AGUARDA USUÁRIO |
| 30 | **Ligação real de teste (custo mínimo)** | `POST /api/voice/call { phoneNumber: "+55...", token }` — usar número de teste, ~30s | ⏳ AGUARDA USUÁRIO |
| 31 | **Medir custo real por ligação qualificada** | `GET /api/voice/call/{id}` → campo `cost` do provider | ⏳ AGUARDA USUÁRIO |
| 32 | **Docs de setup Vapi/Bland** | Criar `docs/GUIA-VOICE-AI-SETUP.md` (após teste real) | ⏳ AGUARDA USUÁRIO |

---

## 6) ITEM 6: WhatsApp CoEx — ✅ IMPLEMENTADO E TESTADO

**Objetivo:** Mesmo número no celular (humano) + API (bot) simultaneamente — paridade com OnlyFlow.

**Status:** código completo em `worker.js`, 41/41 testes em `test/test-wa-coex.js`,
`node --check` PASS, `scripts/predeploy-check.ps1` **PREDEPLOY PASS 100%** (590 testes).
**Falta apenas a validação real** com o CoEx ativado na conta Meta do cliente (bloqueio externo).

### O que foi implementado
- **Core CoEx** (`worker.js:111-190`): `COEX_HUMAN_TRIGGERS`, `COEX_BOT_TRIGGERS`,
  `COEX_DEFAULT_HUMAN_KEYWORDS`, `getCoexConfig`, `coexTriggersHuman`, `coexTriggersBot`,
  `coexSetHuman`, `coexClearHuman`, `coexIsHuman`, `coexActiveList`.
- **Estado por contato** (não global): `wa:coex:human:{dom}:{from}` com TTL +
  índice `wa:coex:index:{dom}` (SET) + `wa:conv:{dom}:{from}` (30d).
- **Métricas** `wa:coex:metrics:{dom}:{dayKey}`: `inbound`, `handoffs`, `resolved`,
  `resolved_ms_total`, `bot_silent`, `reason_*`, `status_*`.
- **`POST /webhook/whatsapp` reescrito**: status callbacks da Meta sem resposta; valida
  E.164 e `phone_id`→dom; toda mensagem vira lead + `inbound` **antes** das rotas;
  precedência = devolução ao bot → handoff → silêncio do bot → fast-path de intenção.
- **Endpoints (JWT)**: `POST/GET /api/wa-coex/config`, `GET /api/wa-coex/metrics`,
  `POST /api/wa-coex/handoff` (com `resume`), `GET /api/wa-coex/active`.
- **Card "🔀 WhatsApp CoEx"** no `/dash`: toggle, gatilhos, TTL (piso 300s), métricas do dia
  e lista de conversas ativas com "devolver ao bot".
- **Guia do cliente**: `docs/GUIA-WHATSAPP-COEX.md`.

### Bugs preexistentes corrigidos no caminho
1. **`replyChannel` descartava o texto de IA no WhatsApp** — enviava só o botão.
   Agora `sendWhatsAppText` manda o texto; o botão só vai junto quando o texto indica
   pagamento/garantia ou quando não há texto. Também silencia o bot se o contato está em handoff.
2. **Alias de validação quebrado** — `REQUIRED_FIELDS.whatsapp` exigia só
   `webhook_verify_token`, mas o dashboard grava `wa_verify_token`: toda configuração de
   WhatsApp pelo painel era rejeitada com 400. Agora `validateChannelConfig` aceita grupos de
   aliases (string ou array) e ambos funcionam.
3. **Segredos em texto puro** — `maskChannelSecrets` aplicado a `GET /api/channel-config/all`,
   `GET /api/channel-config/{channel}` e ao `config` do `POST /api/channel-config/{channel}`
   (valor trocado por `*_set: true`).
4. **Re-salvar credenciais apagava o CoEx** — o `POST /api/channel-config/whatsapp` agora
   preserva chaves `coex_*` já configuradas.

### O que ainda depende de terceiros
- **Ativar CoEx na Meta** (Business Manager → WhatsApp Manager → Coexistence): definir
  "início da coexistência" com os números dos atendentes e confirmar o PIN de 6 dígitos.
  Sem isso o bot funciona sozinho, mas o cliente não chega ao humano pelo mesmo número.
  Passo a passo em `docs/GUIA-WHATSAPP-COEX.md` §3.
- **Hardening recomendado**: `/webhook/whatsapp` ainda não valida `X-Hub-Signature-256`
  (comportamento anterior ao CoEx).

---

## 7) Erros Conhecidos e Workarounds

| Erro | Local | Workaround / Fix |
|------|-------|------------------|
| **Colisão key Redis `swarm:usage:{dom}`** | `worker.js:1334-1338` vs `guardian()` linha 1526 | **Fix obrigatório**: renomear para `swarm:llm:usage:{dom}` em `trackLlmUsage`. O `guardian` usa `swarm:usage:{dom}:YYYY-MM-DDTHH` (STRING, contador horário). Não mexer no `guardian`. |
| **`LLM_COST_RATES` OpenAI errado** | `worker.js:1328` | `0.000003 / 1e6 * 5.5` = 1.65e-11 (errado). Correto: GPT-4o-mini input $0.15/1M → `0.15/1e6*5.5 = 8.25e-7`. Output $0.60/1M → `3.3e-6`. Usar valores por 1M tokens × 5.50. |
| **`trackLlmUsage` não chamado em nenhum provider** | `callLLM` linhas 1351-1418 | Adicionar chamada após cada `fetch` bem-sucedido. Extrair `usage` do JSON de resposta (OpenAI/DeepSeek/Anthropic têm `usage.prompt_tokens`, `usage.completion_tokens`). Custom endpoint: tentar ler `usage` senão estimar. |
| **Dashboard não tem JS para buscar `/api/usage-metrics`** | `dashPage()` script section | Adicionar `loadUsageMetrics()` + chamada em `load()`. Tratar 401/erro. |
| **Custo guard no SDR usa `swarm:budget` (contador chamadas), não custo R$** | `qualifyLead` linha 1587 | O `swarm:budget:{dom}:{day}` conta chamadas LLM (INCR). Para alerta "custo >15% receita" no dashboard, calcular: `usageMetrics.today.cost_r$ / (revenue_cents/100) > 0.15`. |
| **`dayKey()` não exportada/visível no escopo do `trackLlmUsage`** | `worker.js:1332` | Verificar se `dayKey()` está disponível (provavelmente sim, usada em `llmBudget` linha 1528). Se não, replicar: `new Date().toISOString().slice(0,10)`. |
| **Test harness pode não persistir HINCRBYFLOAT entre testes** | `test/harness.js:99-104` | `HINCRBYFLOAT` implementado no MiniRedis. Verificar se testes isolados limpam store (`redisStore = new MiniRedis()` no `beforeEach`). |

---

## Comandos de Verificação Rápida

```powershell
# 1. Sintaxe
node --check worker.js

# 2. Regressão completa
powershell -ExecutionPolicy Bypass -File scripts\predeploy-check.ps1

# 3. Verificar keys Redis em uso (local via harness)
node -e "require('./test/harness.js')"  # testa MiniRedis commands

# 4. Deploy (só após 1+2 PASS)
npx.cmd wrangler deploy --name midas-core

# 5. Smoke pós-deploy
node scripts\smoke-live.js
node scripts\smoke-12-personas.js
```

---

## Referências Rápidas

- **PLANO-MESTRE-CHATPAY-v2.md** — ITEM 4, 5 e 6 concluídos; próximo é validação real do CoEx na Meta
- **AGENTS.md** — §1.14 (Pricing), §1.15 (Voice AI) e §1.16 (WhatsApp CoEx) concluídos; §2 pendências P1/P5/P6/P8/P9
- **worker.js** — `SECRET_CONFIG_FIELDS`/`maskChannelSecrets` (67-82), core CoEx (111-190), `validateChannelConfig` (251), `replyChannel` (2839), `dashPage()` + card CoEx (~3284), `/webhook/whatsapp` (3603), endpoints CoEx (3668-3760), `LLM_COST_RATES` + `trackLlmUsage` (1325-1354), classes Voice (1356-1465), `/api/usage-metrics` (4609)
- **test/test-wa-coex.js** — 41 asserts do ITEM 6 · **test/harness.js** — `faults.graphCalls` captura payloads da Graph API
- **docs/GUIA-WHATSAPP-COEX.md** — guia do cliente (painel + Meta + checklist de validação)
- **src/integrations/voice/** — `vapi-integration.js`, `bland-integration.js`, `voice-router.js`, `iflytek-integration.js`
- **scripts/llm-providers.js** — `DEEPSEEK_CONFIG`, `estimateDeepSeekCostBrl`
- **scripts/secret-loader.js** — `SECRET_NAMES` (inclui 4 secrets de voice)
- **test/harness.js** — MiniRedis com `HINCRBY`, `HINCRBYFLOAT`, `SETEX`, `RPUSH`
- **docs/roadmap/ROADMAP.md** — Fase 2 (Voice AI) ✅, Fase 3+ pendente
- **docs/deploy-runbook.md** — gates, rollback, Vectorize maintenance