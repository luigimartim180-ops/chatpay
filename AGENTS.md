# AGENTS.md — CHECKLIST VIVO (ChatPay)

> **REGRA OBRIGATÓRIA PARA QUALQUER IA QUE OPERAR AQUI**
> 1. Ao **iniciar** uma sessão neste repositório: LEIA este arquivo primeiro (é o estado atual do projeto).
> 2. Ao **concluir qualquer seção/tarefa**: ATUALIZE este arquivo na mesma hora — marque `[x]`, mova itens para "Concluído", adicione novos pendentes com data e evidência.
> 3. **Nunca apague** um item; só mova de seção (Pendente → Concluído / Cancelado com motivo).
> 4. Histórico detalhado por fase (legado): `PROGRESS.md`. Roteiro de testes completo: `docs/qa/GUIA-TESTES.md`. **Briefing para um 2º revisor/editor (entrelinhas, chaves, processos, o que falta): `docs/HANDOFF-REVISOR.md` — ler antes de assumir a manutenção.**
>
> Este arquivo existe porque o projeto tem muitas frentes e qualquer modelo (opencode, Cursor, etc.) precisa retomar do ponto certo sem repetir trabalho.

**Última atualização**: 2026-10-09 (por Kilo — **Dashboard cards + APIs completos**: 8 cards na aba Swarm & IA (Agent Graph, Memory Layer, Scout, Modos Operantis, Aprendizado por Segmento, Dogfooding, Minhas Vendas, Webhooks), 2 APIs (/api/sales CSV, /api/webhooks CRUD+test HMAC); predeploy 601/601 PASS).

---

## 0. SNAPSHOT ATUAL (estado de produção agora)

| Item | Valor |
|------|-------|
| Worker | `midis-core` → https://midas-core.novoronaldo-m.workers.dev |
| **Versão em prod** | `30854ff7-5d12-48e6-b9d4-d6b7fc5301cb` (deploy 2026-10-05 — Dashboard Padronizado: chatpay-dash.html integrado) |
| Rollback imediato | versão anterior `aab788de-1130-425c-afd2-1bb875ff8d5f` (deploy 2026-10-05 — Novo Frontend Claude) |
| Índice Vectorize | `kb-midas-core` (1024 dims, cosine) + metadata index `domain` (string, mutation `58d49bb1`) |
| Vetores em prod | **22** = `chatpay.kb.md` 6 chunks + `MAFEL-KB.md` 16 chunks (só subseções `### 5.x`) |
| Domínio teste | `chatpay.oficial` · bot mestre `@ChatPayteste_bot` · chat real `998009360` |
| Produto | `id:1788877711909`, `9700` cents (R$ 97,00) |
| Regressão | phase1 **33/33**, phase2 **22/22**, phase3-kb **20/20**, phase4-mafel **14/14**, coex **41/41**, **v24-ux 4/4**, **v24-ux-edge 7/7**, predeploy **PASS** **(601 testes: +4 UX-FAST +7 UX-FAST-edge)** |
| Smoke ao vivo | **10/10 ALL PASS** (fase 3) + **12 personas 17/17 ALL PASS** (2026-09-24, deploy 6f296d08) |
| FASE M real | **20 personas / 100 chamadas reais (Groq)**, gate `--require-real` PASS, 1 reply vazia — ver §1.9 |
| **Timeout fix** | **Groq chamadas ≤30s** (era 52 min travado) — `fetchWithTimeout(30s)` em todos providers |
| **plays.json** | **Consumido** via `getV23Plays()` no worker.js (substituiu `V23_PLAYS` hardcoded) |
| **Personas** | **20 × 3 objeções** (era 1) — alinhado com currículo nível 10 |
| Secrets wrangler | 6 presentes · zero chaves proibidas no repo |
| Canais Sociais | Instagram/YouTube/TikTok operacionais (webhooks + `/api/hunter-lead`); `docs/GUIA-YOUTUBE-SETUP.md` e `docs/GUIA-CLIENTE-SETUP-COMPLETO.md` criados 2026-09-25 |
| Arq. canais | 100% API/Backend (Tampermonkey/userscript **removido** do repo — `glob` confirma zero arquivos `userscript*`) |

---

## 1. CONCLUÍDO ✅

### 1.1 Diretriz de mensagens Telegram (links, honestidade, gate)
- [x] Links de compra `&p=` (`buildPayLink`, `parseTgToolCall`, gate `applyLinkPolicy`) — pagos/objetivo levam link, garantia/preço-info/produto NÃO levam.
- [x] Fast-paths: `fastTelegramPriceReply`, `fastTelegramProductReply` (com/sem link conforme §10).
- [x] "Paguei" honesto sem fake-confirm (consulta tx real no Redis: `payment_status`).
- [x] Dedup de bolha idêntica 10 min (`tg:lastreply:{chatId}` → `status:'deduped'`).
- [x] Handoff irritado 2x (`handoff_irritado` + `tg:handoff`), comandos `/menu /preco /garantia /retomar`.
- [x] Anti-injeção, rate limit `/start`, webhook secret `x-telegram-bot-api-secret-token: tg__shared`.

### 1.2 RAG / Vectorize / KB
- [x] Upload de KB (`kbUpload`): chunking + embed `@cf/baai/bge-m3` (fallback `bge-large-en-v1.5` 1024) + espelho Redis `kb:{domain}` (merge por filename).
- [x] **Chunking `###`-only**: doc com `###` → só subseções viram chunk (com contexto do `##` pai; flush em `##` antes de trocar parent); só `##` → seções + janela; sem cabeçalho → janela 800/100. Seções meta (0/6/10/11) ficam FORA da retrieval.
- [x] `kbRetrieve`: query → `VECTORIZE.query` com filtro `domain` → top-4 ≥ 0.35 → fallback keyword (Redis) se falhar.
- [x] `fillKbVars`: `{{NOME_AGENTE}} {{NOME_LOJA}} {{PRODUTO_PRINCIPAL}} {{PRECO}} {{PRECO_POR_DIA}} {{GARANTIA_DIAS}} {{LINK_CHECKOUT}} {{NICHO}} {{FORMAS_PAGAMENTO}} {{REGRAS_LOJISTA}}` → dados reais; resíduos `{{}}` removidos.
- [x] Override `kb_rag_reply` e `faq_search` com slice **900** chars (era 400).
- [x] `buildTelegramFacts`: `REGRAS DO LOJISTA` + `PROIBICOES DO LOJISTA` ANTES de catálogo/KB (hierarquia §10).
- [x] `faq_candidates:{dom}`: LPUSH + LTRIM 100 + TTL 30d quando cai em `playbook_fallback` (§5.15).
- [x] KB mestre MAFEL criada (`docs/kb/MAFEL-KB.md`, autoridade 2ª, §0 não-cliente + §11 QA) e no ar.
- [x] `scripts/upload-kb.ps1` corrigido: bytes UTF-8 (`[IO.File]::ReadAllText`), `charset=utf-8`, valida `chunks>=2`.
- [x] Índice de metadata `domain` criado → filtro por domínio ativo.
- [x] Limpeza de índice (2026-09-24): 37 vetores antigos deletados (`delete-vectors`, mutation `9b71dc10`), re-upload dos 2 docs → 22 vetores frescos, zero órfãos.

### 1.3 Voz / STT / tool calling
- [x] Voz → STT; falha → honesto `audio_failed` ("Não consegui transcrever…").
- [x] Tool loop determinístico ≤ 2 iterações (`executeTgTool`, whitelist).

### 1.4 Testes (rodando: `powershell -ExecutionPolicy Bypass -File scripts\predeploy-check.ps1`)
- [x] `test/test-phase1.js` → **33/33** (webhook, sessão, pagamento, dedup, callbacks, **grupos**).
- [x] `test/test-phase2.js` → **22/22** (intenções, FSM, menu, handoff, anti-injeção).
- [x] `test/test-phase3-kb.js` → **20/20** (links, chunkText 3 modos, `fillKbVars`, upload MAFEL, gate).
- [x] `test/test-phase4-mafel.js` → **14/14** (conjunto dourado §11: G1–G12 + static + setup).
- [x] Suítes legadas verdes: v23, v22.4, v22.1.2 (35/35), v22.1.1 (50), v22.1 (54), v22 (56), v22.2 (33), channels (32), boundary, demo, simulador.
- [x] `scripts/predeploy-check.ps1` inclui phase3 + phase4; última rodada: **PREDEPLOY PASS, EXIT=0**.
- [x] Smoke ao vivo `10/10` (**2026-09-24**) — scripts agora no repo: `scripts/smoke-live.js` (10 casos) e `scripts/smoke-12-personas.js` (17 asserts).
- [x] Probes ao vivo pós-deploy: `ta caro`→seção 5.11, `vendo trufas…`→5.6, `vou pensar`→5.12, "cancelar assinatura"→5.9 — sem `{{}}`, sem pay-link indevido.

### 1.7 Sessão "Avançando em chat" — 12 tarefas verificadas 12/12 (2026-09-24)
- [x] T1 Mapear código (webhook/FSM/comandos/LLM/harness) → docs (`GUIA-TESTES.md`, `store-data.md`, `playbook-fallback.md`).
- [x] T2 Botões de menu → `buildTelegramInlineKeyboard` (worker.js:200) aplicado em todos os envios de menu (:886, :925, :2961).
- [x] T3 FSM por chat → `tg:state:{chatId}` (worker.js:496/502, TTL) + `tg:tags` (phase2 P1–P12).
- [x] T4 Contrato LLM `{intent, reply}` + retry + fallback → worker.js:3265 (timeout 8s `TG_LLM_TIMEOUT_MS`, 1 retry, falha → menu `llm_fallback_menu`).
- [x] T5 Comandos `/start /menu /preco /garantia /pagamento /humano /id /retomar` → worker.js:2891–3102.
- [x] T6 Tom "equipe ChatPay" (:3032) + anti-injeção `detectTgInjection` (:540, :3113).
- [x] T7 Handoff: `/humano` + `notifyTgOwner` + TTL 7200 (`tg:handoff`, :535) + irritado 2x + `/retomar`.
- [x] T8 Latência: fast-paths sem LLM + LLM timeout 8s.
- [x] T9 `docs/qa/GUIA-TESTES.md` com 12 personas (tabela smoke).
- [x] T10 `test/test-phase2.js` → 22/22 (personas, FSM, callbacks, injeção, handoff).
- [x] T11 Regressão `node --check` + phase1 + boundary + v23 + v22.4 → predeploy **PASS EXIT=0**.
- [x] T12 Deploy + smoke 12 personas ao vivo → deploy `d5de4457` + **re-smoke 17/17 ALL PASS** (`smoke-12-personas.js`, 2026-09-24).

### 1.8 Pendências executadas em 2026-09-24 (rodada pós-checklist)
- [x] **P2 — `security-audit.ps1` re-executado** contra prod (deploy `d5de4457`): **31/31 PASS, EXIT=0** (A:12×401, B:7×200, C:12×401).
- [x] **P3 — `postdeploy-smoke.ps1` executado pela 1ª vez**: **6/6 PASS, POSTDEPLOY PASS, EXIT=0** + Version ID `d5de4457` (script corrigido: PS 5.1 lança exceção em 4xx → `Get-Json` trata; shape do `agent-graph` aceita `agentes`/`pipeline`; parse de version-id pega a ÚLTIMA `Version(s):` da lista cronológica, com EAP=Continue durante o npx).
- [x] **P7 — Smoke scripts movidos para o repo**: `scripts/smoke-live.js` (10 casos) + `scripts/smoke-12-personas.js` (17 asserts) — não dependem mais de Temp.
- [x] **P8 — Índice conferido**: `list-vectors` = **22/22** (MAFEL 0–15 + chatpay.kb.md 0–5), zero órfãos; procedimento de limpeza documentado no runbook.
- [x] **P9 — `faq_candidates` verificado**: branch `playbook_fallback` exercitado ao vivo (persona P4 do smoke 17/17) e LPUSH/LTRIM/EXPIRE unit-assertado (G9, phase4); leitura direta do Redis indisponível localmente (sem credencial fora do worker).
- [x] **P10 — `docs/deploy-runbook.md` atualizado**: versão `d5de4457` + rollback `381e384e` + gates do deploy + seção "Manutenção do índice Vectorize" (list → delete-vectors → re-upload → metadata index).
- [x] **P11 — `PROGRESS.md` declarado somente-legado** (nota no topo apontando para este AGENTS.md como checklist vivo; histórico paramado na FASE M2 por design).

### 1.9 Canal de vendas em grupo + FASE M real (2026-09-24, deploy `6f296d08`)
- [x] **Grupo Telegram suportado pelo worker**: `isStart` aceita `/start@NomeDoBot <dom>` (worker.js:2891, padrão de grupos) → `bindTgSession` no `chat.id` do grupo; webhook **não filtra `chat.type`** (privado, group e supergroup processam igual).
- [x] **Dedup de bolha desativado em grupo** (worker.js:~3351, `isGroupChat`): clientes distintos na mesma sala não se engatam resposta idêntica; privado mantém dedup 10 min (G12/phase4 intactos).
- [x] `test/test-phase1.js` → **33/33** (2 asserts novos: bind via `/start@ChatPayteste_bot` + grupo sem dedup).
- [x] Gates do deploy `6f296d08`: predeploy **PASS EXIT=0** · postdeploy **6/6** · security-audit **31/31** · smoke-live **10/10** · smoke-12 **17/17**.
- [x] **FASE M rodada real executada** (n=20 personas, seed 20260910, `--require-real --batch 5` ×4): **100/100 chamadas reais Groq** (Cerebras 402 → fallback automático), gate `>=20 chamadas` **PASS em todos os batches**, **1 reply vazio** (era 6/25 antes do fix), evidência em `simulator/batch-state.json` + `simulator/report.json` (telemetry `gate_pass: true`, `real_provider_calls: 25` no batch final).
- [x] **Fix de metodologia (não-mock)**: simulador agora envia `buildSimAgentPrompt` (`scripts/llm-providers.js`) com papel/fatos reais do vendedor (R$97, Pix/12x, garantia 7d, link oficial, PT-BR ≤2 frases) — antes mandava só a fala do lead e o modelo respondia como "ChatGPT" (identidade vazando). Batch-state envenenado resetado antes do run limpo; `cache-real.json` recriado.
- [x] **Fix `max_tokens` 300 → 800** (llm-providers.js:84/96/123/135): `openai/gpt-oss-20b` gasta ~298 tokens em reasoning e respondia vazio — com 800, 99/100 replies úteis.
- [x] `docs/deploy-runbook.md` (versão/rollback/gates), `docs/qa/GUIA-TESTES.md` (bloco deploy grupos) atualizados.
- [x] **Probe ao vivo do caminho de grupo em prod** (supergroup `-100777666555` via webhook real): `/start@ChatPayteste_bot` → `start_bound` + `domain: chatpay.oficial` ✓; duas `qual a garantia?` idênticas → **nenhuma veio `deduped`** (segunda resposta completa) ✓; `send_failed` esperado (chat não existe — id fake).

### 1.10 Diagnóstico STT + Análise FASE M (2026-09-24, sessão Devin)
- [x] **Logging STT adicionado** (worker.js:2863-2897, 695-716): `tg_stt_error` loga getFile/download/transcribe com erro detalhado; métrica `tg:metric:audio_failed:{dia}` adicionada; antes só logava sucesso (`tg_voice_transcribed`).
- [x] **Script diagnóstico criado**: `scripts/test-stt-diagnostic.js` explica fluxo STT, limitações dos testes atuais, recomendações para teste manual em produção.
- [x] **Análise qualidade FASE M**: `scripts/analyze-mafel-quality.js` mostra 1/100 vazia (diego-iniciante turno 1, reasoning 798/800), 96/100 com alto reasoning (>50%), zero respostas curtas/longas extremas.
- [x] **Evidências FASE I4 preparadas**: `docs/FASE-I4-EVIDENCIA.md` distingue gate de chamadas reais (PASS) vs gate de bandas (FAIL esperado no mock), recomenda não alterar bandas sem rodada real + aprovação arquiteto.
- [x] **Refatoração FSM grupo documentada**: `docs/FSM-USUARIO-GROUP-REFATORACAO.md` analisa problema (handoff por chat afeta grupo inteiro), propõe schema `{chatId}:{userId}`, estimativa de esforço alto, alternativa mitigação simples (3 mensagens mesmo usuário).
- [x] **Fix testes do RAG/KB chunking**: `test-phase3-kb.js` corrigido para alinhar com a nova lógica de preservar cabeçalhos (`##` e `###`) no `chunkText` para garantir o contexto no Vectorize, e só limpar a resposta final usando `fillKbVars`.
- [x] **P1.1 — Teste manual STT real concluído**: Áudio real enviado ao bot no Telegram (print anexado pelo usuário) e a transcrição funcionou. O bot identificou a intenção (ex: "tá caro") via KB RAG e gerou resposta, porém retornava cabeçalhos brutos. O problema do retorno bruto foi corrigido nesta sessão (ajustes no `chunkText` e `fillKbVars`).
- [x] **P5.1 — Mitigação FSM por usuário em grupo**: Adicionado tracking de `tg:irritado:{chatId}:{userId}` para grupos, exigindo 3 mensagens do MESMO usuário para disparar o `handoff_irritado` no grupo, evitando que o contador seja misturado entre usuários.

### 1.5 Docs atualizadas
- [x] `docs/qa/GUIA-TESTES.md` — deploy `d5de4457`, phase4 14/14, chunking `###`-only, contagens de KB.
- [x] `docs/store-data.md` — `buildTelegramFacts(domain, env, query)`, `fillKbVars`, fast-paths.
- [x] `docs/playbook-fallback.md` — fluxo override KB, callback garantia sem link.
- [x] `docs/deploy-runbook.md` — versão `29b1d54f` em prod, rollback `6f296d08`, gates do deploy, manutenção do índice Vectorize (list → delete-vectors → re-upload → metadata index).
- [x] `docs/HANDOFF-REVISOR.md` — briefing para 2º revisor (entrelinhas, hotspots, processos, pendências).
- [x] `docs/pix-payment.md` — fluxo Pix (`/chatpay/charge`, `/confirm`, poll `/chatpay/status`, `lookupTelegramPayment` L761).
- [x] `docs/FASE-I4-EVIDENCIA.md` — evidências para aprovação arquiteto (gate chamadas reais vs gate bandas, análise qualidade replies).
- [x] `docs/FSM-USUARIO-GROUP-REFATORACAO.md` — análise problema handoff por chat em grupo, proposta schema `{chatId}:{userId}`, estimativa esforço.
- [x] `docs/GUIA-YOUTUBE-SETUP.md` — guia prático setup YouTube (ID canal `UCvnQBOPmDKDFHq4FPa7LvQw`, webhook `/webhook/youtube`, teste ao vivo via comentário em live/vídeo).
- [x] `docs/GUIA-CLIENTE-SETUP-COMPLETO.md` — guia cliente unificado: loja/produtos, Pix, RAG/KB, Swarm de agentes (classifyIntent→objectionHandler→craftReply→proofGenerator→timingOptimizer→upsellArchitect→scheduleRecovery), canais sociais (Instagram/YouTube/TikTok).
- [x] `docs/roadmap/ROADMAP.md` — roadmap multicanal (Fase 0 Telegram → Fase 1 Shared Bot → Fase 2 Voice AI → Fase 3 APIs chinesas → Fase 4 Spatial → Fase 5 integração).
- [x] `docs/kb/MAFEL-KB.md` — KB mestre (autoridade 2ª, 16 seções 5.x + §0 não-cliente + §11 QA).
- [x] `PROGRESS.md` — histórico das fases 0–M2 (legado; não reflete as frentes recentes deste checklist).
- [x] `simulator/report.md` + `simulator/report-decisao.md` — evidências FASE E (seed 20260909, win_rate 0 no mock, gate bandas FAIL esperado).

### 1.6 Entregas anteriores (ver PROGRESS.md para detalhe)
- [x] Fases 0–L3: 26 falhas de teste, setup de negócio (Pix CPF + produto real), dogfooding, V23 (7 estágios, 12 plays, Scout, ROI), FASE K (K1–K6 anti-fake), security-audit **31/31**, dashboard `/dash`, simulators.
- [x] Deploys históricos: `f966e8ae` → `8f50bfc6` → `dbd8d304` → `c332dcc0` → `71ead478` → `c7322f55` → … → `b9a87163` → `381e384e` → `d5de4457` → `6f296d08` → **`29b1d54f` (atual)**.

### 1.11 Canais Sociais & Hunter Lead Ingestion (Instagram, YouTube, TikTok) ✅ (2026-09-24)
- [x] **Ingestão universal de leads sociais**: endpoint `POST /api/hunter-lead` aceita leads de Instagram, YouTube, TikTok, Telegram e Web, salva em `hunter:leads:{dom}`, aciona `classifyIntentAdvanced` + `craftReply` e devolve a resposta gerada por IA com link de checkout seguro.
- [x] **Webhooks Meta/Instagram ativos**: `GET /webhook/instagram` (suporte a `hub.challenge` text/plain) e `POST /webhook/instagram` (mensagens Direct e comentários com resposta automática via Meta Graph API).
- [x] **Webhooks YouTube & TikTok ativos**: `POST /webhook/youtube` e `POST /webhook/tiktok` registram leads de live chat e comentários no `hunter:leads:{dom}` e disparam eventos para o Swarm de IA.
- [x] **Gestão de canais no Dashboard (`/dash`)**: novo card com formulários e botões de teste instantâneo de conexão (`POST /api/channel-config/{ch}/test`) para Instagram, YouTube, TikTok e Telegram.
- [x] ~~**Hunter Userscript 1.2.0**: `hunter-social/userscript.js`~~ (Removido: solução baseada em Tampermonkey/Extensões excluída do repositório a pedido do cliente para não gerar confusão. Foco total em ingestão limpa via API/Backend).
- [x] **Suíte de testes de canais sociais**: `test/test-social-channels.js` (10/10 PASS) + regressão predeploy **PASS EXIT=0** (33/33 V22.2, 32/32 V22.2-channels, 56/56 V22).

### 1.12 DeepSeek Provider Integration (2026-09-25)
- [x] **DeepSeek V3 (`deepseek-chat`) + R1 (`deepseek-reasoner`)** adicionados em `scripts/llm-providers.js` (`DEEPSEEK_CONFIG`, `deepseek`/`deepseek_reasoner` chain methods) com endpoint OpenAI-compatible `https://api.deepseek.com/v1/chat/completions`.
- [x] **Cost tracking BRL** implementado: V3 $0.14/1M in $0.28/1M out; R1 $0.55/1M in $2.19/1M out (cotação R$5.50/USD) — `estimateDeepSeekCostBrl` calcula `cost_r$` a partir de `usage.total_tokens`.
- [x] **`DEEPSEEK_API_KEY`** adicionado a `SECRET_NAMES` (secret-loader.js) + probes em `probeProviders`.
- [x] `deepseek` incluído em `PROVIDER_ORDER` e `REAL_PROVIDERS` (fallback automático para groq/openrouter/...).
- [x] `worker.js` `callLLM` — novos providers `deepseek_chat` (max_tokens 800) e `deepseek_reasoner` (max_tokens 3200) + opções no dashboard (`/dash` swarm selector).
- [x] Smoke predeploy: `node --check worker.js` OK · **PREDEPLOY PASS 100%** (phase1 33/33, phase2 22/22, phase3 14/14, phase4 14/14, v23 23/23, v22.4 56/56, v22.1.2 35/35, v22 56/56, v22.2 33/33, v22.2-channels 32/32, demo PASS, sim PASS, zero padrões proibidos).
- [x] Graciosamente degraded sem chave (`skipped: 'DEEPSEEK_API_KEY ausente'`) — sem regressão no pipeline local/mock.

### 1.13 SDR Agent — Qualificação BANT/MEDDIC/SPIN (2026-09-25)
- [x] `qualifyLead(dom, text, context, env)` em `worker.js:1556` — scoring híbrido: regex (fast-path) + DeepSeek R1 reasoning (LLM path) quando playbook configura `llm_provider: 'deepseek_reasoner'` + `llm_key`.
- [x] **BANT**: Budget, Authority, Need, Timing (regex + LLM confidence scores).
- [x] **MEDDIC**: Metrics, Economic Buyer, Decision Criteria, Decision Process, Identify Pain, Champion — auto-selecionado quando `scoreMEDDIC >= 3 && scoreBANT >= 2`.
- [x] **SPIN**: Situation, Problem, Implication, Need-Payoff — auto-selecionado quando `scoreSPIN >= 3`.
- [x] **Cost guard**: `< 15% receita` — quando orçamento LLM diário excede 15% do ticket do produto (`swarm:budget:{dom}:{day}` > `precoGuard * 0.15`), qualificação é bloqueada (`methodology: 'cost_guard'`, `llm_used: false`).
- [x] Resultado persistido em `swarm:qualification:{dom}:{lead_id}` (SETEX 24h) + log `qualify_lead` com telemetry completa.
- [x] `nextAction` influencia pipeline: `close` (stage CLOSE → closer), `qualify` (stage QUALIFY) ou `nurture` — integrado com `directorAgent` e `runAgentPipelineCore`.
- [x] **Tests V23 C2.1-C2.4** (4 testes, 11 asserts): gate `enable_qualification`, persistência Redis, regex scoring, LLM reasoning path via DeepSeek R1 stub, cost guard blocking.
- [x] `predeploy-check.psl` → **PREDEPLOY PASS 100%** (test-v23 agora 44/44, todos outros suites intactos).

### 1.14 Pricing Transparente no Dashboard (ITEM 4 do PLANO-MESTRE-CHATPAY-v2.md) (2026-09-25)
- [x] **`LLM_COST_RATES` corrigidos** (`worker.js:1325-1330`): OpenAI GPT-4o-mini $0.15/1M in, $0.60/1M out; Anthropic Claude 3 Haiku $0.25/1M in, $1.25/1M out; DeepSeek V3/R1 vindos do `llm-providers.js`; Workers AI = 0. Cotação fixa R$5.50/USD.
- [x] **`trackLlmUsage` redesignado** (`worker.js:1332-1353`): nova key Redis `swarm:llm:usage:{dom}` (hash acumulado) + `swarm:llm:usage:{dom}:{dayKey}` (hash diário) — evita colisão com `guardian` que usa `swarm:usage:{dom}:YYYY-MM-DDTHH`. Campos: `tokens_in`, `tokens_out`, `cost_r$`, `calls`, `tokens_{provider}`, `cost_{provider}`, `last_call_at`.
- [x] **Integração completa em `callLLM`** (`worker.js:1364-1470`): todos branches (OpenAI, Anthropic, Custom, DeepSeek Chat, DeepSeek Reasoner, Workers AI) extraem `usage.prompt_tokens`/`completion_tokens` da resposta, calculam custo via `LLM_COST_RATES`, chamam `await trackLlmUsage(pb.dom, provider, promptTokens, replyTokens, costR$)`.
- [x] **Endpoint `/api/usage-metrics`** (`worker.js:~4338`): `GET /api/usage-metrics?token=...` (JWT auth) → JSON com `today`/`week`/`month` (tokens_in/out, cost_r$, calls, by_provider), `agents` (execuções por agente via `agent:runs:{dom}`), `revenue_cents` (soma `swarm:txlog`), `budget_used` (`swarm:budget:{dom}:{day}`), `alerts` (quota_80 ≥ 80% de 100k tokens, cost_15pct > 15% receita).
- [x] **Card Dashboard "💰 Uso & Custos LLM"** (`dashPage()` ~linha 2893): grid 6 métricas (Hoje/Semana/Mês: tokens + custo R$), tabela `by_provider`, lista agents executados, badges de alerta (🟡 quota 80%, 🔴 custo >15%), botão "Atualizar" chama `loadUsageMetrics()`.
- [x] **`loadUsageMetrics()` inline JS** (`worker.js:~3080`): fetch `/api/usage-metrics`, popula DOM, trata erro 401/erro.
- [x] **Testes V23 C3.1-C3.3** (`test-v23.js`): C3.1 endpoint retorna dados + today/week/month + agents + revenue + budget + by_provider; C3.2 alerta quota_80 dispara a 85% (85k/100k); C3.3 alerta cost_15pct dispara quando custo hoje (R$20) > 15% receita (R$97 = R$14.55).
- [x] **Harness update**: `test/harness.js` adiciona comando `RPUSH` no MiniRedis para seed de `swarm:txlog`.
- [x] **Predeploy 100% PASS**: 549 testes (phase1 33, phase2 22, phase3 20, phase4 14, v23 47, v22.4 56, v22.1.2 35, v22.1.1 50, v22.1 54, v22 56, v22.2 33, v22.2-channels 32, demo, simulador, boundary, secrets).

### 1.15 Voice AI — Vapi/Bland (ITEM 5 do PLANO-MESTRE-CHATPAY-v2.md) (2026-09-26)
- [x] **Classes de provider** (`worker.js:1356-1465`, inline — worker é arquivo único sem build step): `VapiIntegration` (`createCall`, `getCallStatus`, `endCall`, `getTranscript`, `estimateCost` via `/cost` API) + `BlandIntegration` (`createCall`, `getCallStatus`, `endCall`, `getTranscript`) + `routeCall(providers, params)` com `DEFAULT_VOICE_PRIORITY` (`pt-BR`/`en-US` → `['vapi','bland']`).
- [x] **Scaffolds em `src/integrations/voice/`** atualizados com os mesmos métodos (`vapi-integration.js`, `bland-integration.js`); `voice-router.js` e `iflytek-integration.js` mantidos como referência.
- [x] **Secrets** (`scripts/secret-loader.js`): `VAPI_API_KEY`, `VAPI_ASSISTANT_ID`, `BLAND_API_KEY`, `BLAND_PATH_ID` adicionados a `SECRET_NAMES`.
- [x] **`POST /api/voice/call`** (`worker.js:3470`): JWT auth → valida `phoneNumber` → `routeCall` → persiste `swarm:voice:calls:{dom}` (LPUSH/LTRIM 1000) + `swarm:voice:calls:{dom}:{callId}` (SETEX 24h) → incrementa `swarm:voice:metrics:{dom}:{dayKey}` (`calls`, `cost_estimated`) → `trackLlmUsage(dom, provider, 0, 0, costPerMin)` → `emitSwarmEvent('voice_call')` → log `voice_call_initiated`.
- [x] **`GET /api/voice/calls`**: lista 50 chamadas recentes + métricas do dia.
- [x] **`GET /api/voice/call/{callId}`**: status live no provider (duration, recordingUrl, transcript, cost).
- [x] **`POST /api/voice/config`**: salva credenciais em `cfg:{dom}:integrations` (`vapi_api_key`, `vapi_assistant_id`, `bland_api_key`, `bland_path_id`); env vars (wrangler secrets) têm precedência.
- [x] **Card "🎙️ Voice AI" no `/dash`**: formulário credenciais Vapi/Bland + telefone + idioma + botão "📞 Iniciar Ligação de Vendas" + div métricas.
- [x] **JS inline**: `saveVoiceConfig(provider)` e `initiateVoiceCall()` no script de `dashPage()`.
- [x] **Integração com pricing**: `/api/usage-metrics` retorna `voice: { calls_today, cost_estimated_r$ }`; `loadUsageMetrics()` popula `voice-metrics`.
- [x] **Validação**: `node --check` OK (worker + 3 arquivos voice + secret-loader) · `predeploy-check.ps1` **PREDEPLOY PASS 100%** (549 testes).
- [ ] ⚠️ **Depende de credenciais reais (usuário)**: `npx wrangler secret put VAPI_API_KEY` / `VAPI_ASSISTANT_ID` / `BLAND_API_KEY` / `BLAND_PATH_ID` → `wrangler deploy --name midas-core` → ligação real de teste (~30s, free tier) para medir custo real por ligação qualificada.

### 1.16 WhatsApp CoEx — bot + humano no mesmo número (ITEM 6) (2026-09-26)
- [x] **Core CoEx** (`worker.js:111-190`): `COEX_HUMAN_TRIGGERS`, `COEX_BOT_TRIGGERS`, `COEX_DEFAULT_HUMAN_KEYWORDS`, `getCoexConfig` (merge `cfg:{dom}:integrations` + `channel:config:whatsapp:{dom}`), `coexTriggersHuman`, `coexTriggersBot`, `coexSetHuman`, `coexClearHuman`, `coexIsHuman`, `coexActiveList`.
- [x] **Estado por contato**: `wa:coex:human:{dom}:{from}` (SET + TTL) + índice `wa:coex:index:{dom}` (SET, `coexActiveList` limpa entradas expiradas) + `wa:conv:{dom}:{from}` (TTL 30d).
- [x] **Métricas** em `wa:coex:metrics:{dom}:{dayKey}`: `inbound`, `handoffs`, `resolved`, `resolved_ms_total`, `bot_silent`, `reason_*`, `status_*`; resumo com `pending_today`, `handoff_rate_pct`, `avg_resolution_ms`.
- [x] **Webhook `POST /webhook/whatsapp` reescrito** (`worker.js:3603`): valida `phone_id`→dom e E.164 do `from`; status callbacks da Meta registrados sem resposta; **toda** mensagem vira lead `hunter:leads:{dom}` + `inbound` antes das rotas; ordem de precedência = devolução ao bot → handoff → silêncio do bot → fast-path de intenção.
- [x] **Endpoints CoEx** (JWT): `POST /api/wa-coex/config`, `GET /api/wa-coex/config`, `GET /api/wa-coex/metrics`, `POST /api/wa-coex/handoff` (com `resume`), `GET /api/wa-coex/active`. TTL com piso de 300s.
- [x] **Card "🔀 WhatsApp CoEx"** no `/dash` com toggle, gatilhos, TTL, métricas do dia e lista de conversas ativas com botão "devolver ao bot" (`saveCoex`, `loadCoex`, `coexResume` inline JS).
- [x] **Bug preexistente 1 corrigido** — `replyChannel` descartava o texto de IA no WhatsApp e enviava só o botão. Agora `sendWhatsAppText` envia o texto; o botão só é enviado quando o texto indica pagamento/garantia ou quando não há texto. Também silencia o bot se o contato está em handoff.
- [x] **Bug preexistente 2 corrigido** — `REQUIRED_FIELDS.whatsapp` exigia só `webhook_verify_token`, mas o dashboard grava `wa_verify_token`. Agora o validador aceita **aliases** (entrada string ou array) e ambos funcionam; o erro de 400 cita o grupo de aliases.
- [x] **Segredos nunca voltam em texto puro**: `maskChannelSecrets` aplicado a `GET /api/channel-config/all`, `GET /api/channel-config/{channel}` **e** ao `config` retornado no `POST /api/channel-config/{channel}` (troca o valor por `*_set: true`).
- [x] **Re-salvar credenciais do WhatsApp não apaga mais o CoEx**: o `POST /api/channel-config/whatsapp` preserva chaves `coex_*` já configuradas.
- [x] **Suíte `test/test-wa-coex.js` — 41/41 PASS** (C1 máscara, C2 aliases, C3 handoff+TTL+índice+isolamento por contato+lead, C4 silêncio, C5 retorno, C6 métricas, C7 handoff manual/active list/E.164, C8 CoEx desligado, C9 config custom + piso de TTL, C10 JWT, C11 callbacks de status, C12 phone_id órfão, C13 texto de IA no WhatsApp, C14 silêncio no pipeline, C15 silêncio por contato).
- [x] **Harness** (`test/harness.js`): stub de `graph.facebook.com` agora captura payloads em `faults.graphCalls`.
- [x] **Guia do cliente** `docs/GUIA-WHATSAPP-COEX.md` criado (ativação no painel, passos no Meta, percepção do cliente, endpoints, métricas, limites, checklist de validação).
- [x] **Validação**: `node --check worker.js` PASS · `scripts/predeploy-check.ps1` **PREDEPLOY PASS 100%** (590 testes: +41 CoEx).
- [ ] ⚠️ **Pendente externo (usuário)**: ativar CoEx no número via Meta Business Manager (início da coexistência + PIN de 6 dígitos no WhatsApp Business) e validar ponta a ponta com o time. Ver §GUIA-WHATSAPP-COEX.md §3.
- [ ] ⚠️ **Hardening recomendado**: `/webhook/whatsapp` ainda não valida `X-Hub-Signature-256` (comportamento preexistente).

### 1.17 UX-FAST Checkout — email, polling, expired, paid (2026-10-04)
- [x] **`test-v24-ux.js` — 4/4 PASS**: charge com `buyer_email`, tx-status pending→paid, confirmação, email persistido no Redis, expiração.
- [x] **`test-v24-ux-edge.js` — 7/7 PASS** (casos extremos):
  - **E1** `/pay` contém `<input type="email" required>` (gate front-end HTML5)
  - **E1b** `charge` sem `buyer_email` → salva string vazia no Redis (gate real é no front)
  - **E2** emails inválidos (`abc`, `a@b`) → salvos literalmente; validação via `type=email` no browser
  - **E3** polling timeout 3 min → tx permanece `pending` (limiar de expiração é 24h, não 3 min)
  - **E4** tx `pending` > 24h → status `expired`; `payPage` contém handler de regenerar QR
  - **E5** `/api/tx-status?tx=TXID_JA_PAGO` → retorna `paid` imediatamente (sem polling intermediário)
  - **E6** seed de `paid` durante polling → próxima chamada retorna `paid` (front-end "vira a tela sozinho")
- [x] **`predeploy-check.ps1`** atualizado: `test-v24-ux.js` e `test-v24-ux-edge.js` adicionados à lista de regressão automática.
- [x] **Arquitetura de validação documentada**: e-mail é gate front-end (HTML5 `type=email required`); servidor salva `buyer_email` literalmente — separação clara de responsabilidades.

### 1.18 Mistral Provider Integration (2026-10-08)
- [x] **`mistral` provider adicionado** a `scripts/llm-providers.js`: endpoint `https://api.mistral.ai/v1/chat/completions`, model `env.MISTRAL_MODEL || 'mistral-small-latest'`, max_tokens 800, headers `{ Authorization: Bearer ${mistralKey} }`, telemetry `mistral`. Incluído em `PROVIDER_ORDER` e `REAL_PROVIDERS` (posição **depois de groq, antes de deepseek/openrouter** — cadeia de backup para Groq).
- [x] **Probe endpoint**: `mistral: ['https://api.mistral.ai/v1/chat/completions', env.MISTRAL_API_KEY, { model: env.MISTRAL_MODEL || 'mistral-small-latest', max_tokens: 1 }]`.
- [x] **`MISTRAL_API_KEY` + `MISTRAL_MODEL` adicionados a `SECRET_NAMES`** em `scripts/secret-loader.js` (linhas 5-6) — root cause do `mistral=ausente` corrigida: `loadLabSecrets()` agora lê a key do shell env (45 chars `mstrl_...`).
- [x] **Validação**: `node --check scripts/secret-loader.js` PASS; `loadLabSecrets()` retorna `MISTRAL_API_KEY loaded: true len: 45`; probe real confirma `mistral=429` (rate limit, key válida e endpoint acessível) — antes `ausente`; `node --check scripts/llm-providers.js` PASS.
- [x] Graciosamente degraded sem chave (`skipped: 'MISTRAL_API_KEY ausente ou execução não-local'`).

### 1.19 LLM Provider Timeout Fix + plays.json Integration + Personas Update (2026-10-09)
- [x] **Timeout fix crítico** (`scripts/llm-providers.js`): adicionado `fetchWithTimeout(30000)` wrapper aplicado a **todas** chamadas de provider (Groq, OpenRouter, Mistral, Gemini, Cerebras, DeepSeek, Pollinations, `requestOpenAICompatible`, `deepseekRequest`). Antes Groq travava 52 min sem timeout; agora falha em ≤30s e cai para próximo provider.
- [x] **`plays.json` consumido pelo worker** (`worker.js:2595-2601` → `getV23Plays()`): carregamento dinâmico com fallback síncrono; substituiu array hardcoded `V23_PLAYS`. 4 templates otimizados: `MirrorOpener`, `LabelEmpathy`, `CalibratedQuestion`, `LastMileClose`.
- [x] **Personas atualizadas** (`simulator/personas.json`): 20 personas agora com **3 objeções cada** (antes 1) — alinhado com currículo nível 10 que exige 3 objeções para chegar em `pago`.
- [x] **Rodada 20-personas completa** (seed 20260910, `--require-real --personas-subset 20 --max-turns 5 --no-cache`): **100/100 chamadas reais Groq** concluídas em segundos (timeout fix funcionando); 1 reply vazia (diego-iniciante turno 1, reasoning 798/800 tokens); 99/100 replies úteis; `cache_hit: false` em todas (sem cache stale).
- [x] **Heatmap**: múltiplas personas alcançam `quase_pago` com `paid: true` (ex: bruno-direto, carla-preco, diego-iniciante, elisa-cetica, fabio-ocupado, gabi-objection, hugo-comparador, ines-social, joao-tecnico, lara-urgente, marcos-morno, nina-desconfiada, otavio-indeciso, paula-repetida, rafael-suporte, sara-curta, tiago-corporativo, ursula-mobile, vitor-followup) — progresso vs baseline onde todos ficavam em `quase`.
- [x] **Curriculum bands**: N1-N3 (easy) win_rate 0.95-1.0 mas gate anti-cooperação falha (win_rate=1 detectado como suspeito); N4-N10 (medium/difficult/adversarial) win_rate=0 — requer iteração Weco com instrução focada em personas médias/difíceis (N4-N8) para ≥15% melhoria em 2+ bandas antes de deploy.
- [x] **Predeploy 100% PASS** (601 testes) após todas as mudanças — syntax check, phase1-4, v22-v24, wa-coex, secrets, padrões proibidos.

### 1.20 Fix N3 — Preço 100x Errado (2026-10-09)
- [x] **Bug**: resposta de objeção e outras exibia "R$ 9700.00" em vez de "R$ 97,00" — template `{preco}` inseria cents crus com ".00" anexado.
- [x] **Helper único criado**: `fmtBRL = (cents) => 'R$ ' + (Number(cents)/100).toFixed(2).replace('.', ',')` em `worker.js:59`.
- [x] **Locais corrigidos** (todos usam `fmtBRL` agora):
  - `installmentOffer` (linha 1895) — parcelamento
  - `processPriceWatches` (linha 2863) — notificações de queda de preço
  - `runAnalystDaily` (linha 3143) — digest de receita por email
  - `payPage` JS (linhas 4433, 4450) — cards de produto e status "Escaneie e pague"
  - `/api/wa-send-button` (linha 4602) — botão WhatsApp
  - `replyChannel` WhatsApp (linha 2899) — `pb.floor` passado via `fmtBRL`
- [x] **Validação**: `node --check worker.js` PASS; predeploy **601/601 PASS**; demo mostra "Posso liberar por R$ 97,00?" corretamente.

### 1.21 Dashboard Cards Completion � 8 cards + 2 APIs (2026-10-09)
- [x] **6 cards na aba Swarm & IA** (total 8 cards na aba):
  - Agent Graph V22 � pipeline 5 est�gios + rotas por evento, contagens por agente, �ltima execu��o
  - Memory Layer � RAG objections + reply_winner + segment_patterns, busca por query/tipo, persist�ncia dual Redis+Vectorize
  - Scout � taxa unknown, amostras hoje, top unknown, bot�o "Digestar" ? `/api/scout`
  - Modos Operantis � AUTO/LIVE_SELLING/DM/GROUP/COMMENT/QA, confian�a persistida, salvar ? `/api/op-mode`
  - Aprendizado por Segmento � taxonomia segment/intent/variation CRUD ? `/api/taxonomy`
  - Dogfooding Real-Time � requests/leads hoje, uptime, feed recente ? `/api/dogfooding`
- [x] **2 cards enterprise cr�ticos na aba Swarm & IA**:
  - **Minhas Vendas** � tabela completa (txid, valor, status, rail, lead_id, created_at, buyer_email, play_id), filtros status/data, **Exportar CSV** ? `GET /api/sales?format=csv`
  - **Webhooks** � CRUD completo (criar/listar/deletar), campos url/eventos/secret/ativo, bot�o **"Testar webhook"** dispara payload assinado HMAC-SHA256 ? `POST /api/webhooks/test`
- [x] **APIs adicionadas** (worker.js ~linhas 6415-6470):
  - `GET /api/sales?format=json|csv&limit=200` � lista vendas do dom�nio, exporta��o CSV com headers
  - `GET/POST/DELETE /api/webhooks` � CRUD webhooks persistidos em `swarm:webhooks:{dom}`
  - `POST /api/webhooks/test` � envia payload teste `payment_confirmed` com assinatura HMAC-SHA256 no header `X-ChatPay-Signature`
- [x] **Valida��o**: `node --check worker.js` PASS; `scripts/predeploy-check.ps1` **601/601 PASS**; Dashboard carrega modo Simple/Advanced toggle (`.adv-card` vis�vel por padr�o, oculto em `body.mode-simple`), localStorage `chatpay_dash_mode` persistido

### 1.22 Dashboard Cards 2� Onda � 6 cards analytics + advanced (2026-10-09)
- [x] **6 cards adicionados na aba Swarm & IA** (total 14 cards na aba):
  - **Tool Calling** � Lista de tools do playbook V23 + formul�rio adicionar tool (nome, descri��o, JSON Schema) ? `/api/v23/playbook`
  - **Hunter Analytics** � Leads por plataforma + receita atribu�da + convers�o estimada + gr�fico temporal (Chart.js) ? `/api/hunter-analytics`
  - **ROI do Swarm V23** � Receita total vs custo LLM + ROI % + breakdown por provider ? `/api/v23/roi`
  - **ROI por Play V23** � Tabela + gr�fico de barras com receita atribu�da por play + convers�es ? `/api/v23/roi`
  - **Simulador Adversarial** � Heatmap win rate por persona + resultados detalhados + bot�o executar simula��o (seed, personas, turns, batch) ? `/api/v23/simulator-report`
  - **Relat�rio de Decis�o V23** � Gate status das 10 bandas curriculares + li��es aprendidas + export JSON ? `/api/v23/decision-report`
- [x] **Chart.js 4.4.2** adicionado via CDN no dashboard HTML
- [x] **Auto-load** das 6 novas fun��es no dashboard live
- [x] **Valida��o**: `node --check worker.js` PASS; `scripts/predeploy-check.ps1` **601/601 PASS** (todas as su�tes intactas, incluindo V22 dashboard markers)

## 2. PENDENTE ⬜ (o que falta fazer / checar)

### Prioridade ALTA
- [ ] **P1 — Validação visual humana no Telegram real** (usuário Ronaldo): bolhas, botões do menu, handoff, dedup de mensagens idênticas. Nós validamos via HTTP/respostas; a experiência visual só o humano confirma.
- [ ] **P8 — Voice AI em produção (ITEM 5)**: setar 4 secrets no wrangler, deploy, e 1 ligação real de teste (~30s) para medir custo real. Ver `HANDOFF.md` §4 (itens 28-32).
- [ ] **P9 — ITEM 6: WhatsApp CoEx**: implementado e testado (41/41, ver §1.16) — bot + humano no mesmo número, endpoints, métricas, dashboard, guia do cliente. **Falta apenas a validação real** com o CoEx ativado na conta Meta do cliente (bloqueio externo, credenciais/PIN do Business Manager). Código pronto para deploy.


### Prioridade MÉDIA
- [x] ~~**P4 — FASE M (rodada real)**~~ → **executado 2026-09-24** (movido para §1.9): n=20, 100 chamadas reais Groq, gate PASS; Cerebras segue 402 (quota) mas o fallback automático resolve.
- [ ] **P5 — FASE I4**: aprovação do arquiteto para nova rodada regression-gated (bandas N4–N10 em 0% no mock; não alterar bandas sem evidência). *Evidências preparadas em `docs/FASE-I4-EVIDENCIA.md`*: distingue gate de chamadas reais (PASS) vs gate de bandas (FAIL esperado no mock), análise qualidade replies (99/100 úteis), recomendação max_tokens=1200 para margem reasoning. DeepSeek R1 (`deepseek_reasoner`) agora disponível no `llm-providers.js` para reasoning crítico na próxima rodada.
- [ ] **P6 — WhatsApp real**: preencher `wa_phone_id`, `wa_access_token`, `webhook_verify_token` no `/dash` (ainda PLACEHOLDER) — só necessário para dogfooding no grupo.
- [x] ~~**P7 — Canais Sociais Midas (Instagram, YouTube, TikTok)**~~ → **concluído 2026-09-24** (§1.11): endpoints `/api/hunter-lead`, `/webhook/{instagram,youtube,tiktok}`, painel de gestão/teste no `/dash`, guias `docs/GUIA-YOUTUBE-SETUP.md` (`UCvnQBOPmDKDFHq4FPa7LvQw`) e `docs/GUIA-CLIENTE-SETUP-COMPLETO.md` criados 2026-09-25. Arquitetura 100% API/Backend — Tampermonkey/userscript removido do repo.

---

## 3. BLOQUEIOS EXTERNOS (dependem de terceiros)

| Bloqueio | Impacto | Dono |
|----------|---------|------|
| Crédito/quota de providers LLM (Cerebras 402, 429 nos demais — Groq funciona com retry) | só FASE I4 (bandas reais); FASE M resolvida via fallback; DeepSeek V3 + R1 agora integrados (`llm-providers.js`) aguardando chave | usuário (chaves) |
| Credenciais WhatsApp Meta | dogfooding em grupo | usuário |
| Validação visual no Telegram | aceite final P1 | usuário |

---

## 4. COMANDOS DE VERIFICAÇÃO (rodar nesta ordem antes de qualquer deploy)

```powershell
# 1) Sintaxe
node --check worker.js

# 2) Regressão completa (phase1/2/3/4 + v2x + secrets + padrões proibidos)
powershell -ExecutionPolicy Bypass -File scripts\predeploy-check.ps1

# 3) Deploy
npx.cmd wrangler deploy --name midas-core

# 4) Estado do índice (depois de qualquer mudança de KB)
npx.cmd wrangler vectorize list-vectors kb-midas-core

# 5) Re-upload de KB (UTF-8, valida chunks>=2)
powershell -ExecutionPolicy Bypass -File scripts\upload-kb.ps1 -Domain chatpay.oficial -File data\chatpay.kb.md
powershell -ExecutionPolicy Bypass -File scripts\upload-kb.ps1 -Domain chatpay.oficial -File docs\kb\MAFEL-KB.md

# 6) Smoke ao vivo (10 casos, chat 998009360) + 12 personas (17 asserts)
node scripts\smoke-live.js
node scripts\smoke-12-personas.js
```

PowerShell 5.1: **sem `&&`** (usar `cmd1; if ($?) { cmd2 }`), sucesso via `$LASTEXITCODE`/`$?`. Smokes ao vivo: **sequência única em processo único** (`seq = Date.now()`).

---

## 5. REGRAS INEGOCIÁVEIS

- **Nunca** commitar `.env`, `.env.local`, `*.pem`, `*_API_KEY` ou qualquer segredo. Proibidos no repo: `openrouter.ai`, `generativelanguage.googleapis.com`, `api.groq.com`, literais `*_API_KEY`.
- Worker **sem `fs`/`env.KV`** — persistência via Redis (`loja:{domain}`, `kb:{domain}`, `swarm:prods:{dom}`, `faq_candidates:{dom}`, `tg:lastreply:{chatId}`).
- Hierarquia de conteúdo §10: REGRAS/PROIBICOES do lojista > catálogo > base de conhecimento; KB mestre MAFEL é autoridade 2ª.
- Honesty: sem dado real = sem exibir número; "paguei" nunca confirma sem prova no Redis.
- Todo deploy passa por `predeploy-check.ps1` PASS antes de `wrangler deploy`.
- **Ao terminar qualquer seção: atualizar `AGENTS.md` (este arquivo).**





