# PROMPT DE HANDEOFF — Revisor de código do ChatPay

> **Para quem vai ler este documento**: você é o segundo editor/IA que vai **rever, aprimorar e evoluir** o ChatPay (inclusive os AI Agents). Este briefing existe porque o projeto tem trabalho que **só existe na memória da sessão que fez o último deploy** e não está completo em `PROGRESS.md` nem em `AGENTS.md`. Ele aponta **onde estão as chaves, os processos, as armadilhas e o que falta nas entrelinhas**.
> **Regra**: leia na ordem da §1. Não pule a §4 (é o coração deste documento). Ao terminar qualquer seção/trabalho, atualize `AGENTS.md` (é o checklist vivo obrigatório deste repo).

---

## 0. Sua missão

1. **Rever** o estado atual (deploy, testes, docs) sem quebrar o que está verde.
2. **Entender o que falta** (§7) — inclusive itens que "parecem prontos" mas nunca foram provados ao vivo (ex.: áudio/STT).
3. **Aprimorar os AI Agents** (agent-graph, plays, bandit, honesty judge, FSM do Telegram) com base na §5 e §9.
4. **Nunca** inventar resultado: qualquer validação nova precisa ser **real** (LLM real, Telegram real) — diretriz explícita do dono (§8).

---

## 1. Ordem obrigatória de leitura

1. `AGENTS.md` — checklist vivo: snapshot §0, concluído §1, pendente §2, comandos §4, regras §5.
2. **Este documento** (`docs/HANDOFF-REVISOR.md`) — o "explícito na conversa".
3. `docs/deploy-runbook.md` — versão em prod, rollback, manutenção do índice Vectorize.
4. `docs/qa/GUIA-TESTES.md` — personas, smokes, contagens de regressão, deploys.
5. `docs/store-data.md` + `docs/playbook-fallback.md` — contrato de conteúdo/fatos/link policy.
6. Código: hotspots da §5 (`worker.js` tem ~3843 linhas — não leia linear, vá pelos pontos).
7. `PROGRESS.md` — **legado** (Fases 0–M2). Histórico detalhado, mas **não reflete as frentes recentes** (foi declarado legado de propósito).

---

## 2. Snapshot agora (verifique antes de mexer)

| Item | Valor |
|------|-------|
| Worker | `midas-core` → https://midas-core.novoronaldo-m.workers.dev |
| **Versão em prod** | `29b1d54f-f280-40cd-a4b1-a10271c5096d` (2026-09-24 — Canais Sociais Instagram/YouTube/TikTok + Hunter Lead Ingestion; deploy mais recente) |
| Rollback imediato | `6f296d08-3582-4bcb-871c-1673958f58f8` (deploy grupos + FASE M) |
| Regressão | phase1 **33/33**, phase2 22/22, phase3-kb 20/20, phase4-mafel 14/14, social-channels 10/10, predeploy **PASS EXIT=0** |
| Gates do último deploy | postdeploy **6/6** · security-audit **31/31** · smoke-live **10/10** · smoke-12 **17/17** |
| Índice Vectorize | `kb-midas-core` = **22 vetores** (`chatpay.kb.md` 6 + `MAFEL-KB.md` 16) + metadata index `domain` |
| FASE M real | **20 personas / 100 chamadas reais Groq**, gate `--require-real` PASS, 1 reply vazio |
| Domínio teste | `chatpay.oficial` · bot `@ChatPayteste_bot` · chat privado `998009360` |
| Produto | `id:1788877711909`, `9700` cents (R$ 97,00) |
| Chaves LLM locais | `GROQ_API_KEY` (56), `OPENROUTER_API_KEY` (73), `GEMINI_API_KEY` (53), `CEREBRAS_API_KEY` (52), `GITHUB_TOKEN` (93) no env do shell |
| Pendências | **P1** validação visual (dono) · **P5** bandas FASE I4 (arquiteto) · **P6** WhatsApp (credenciais Meta) · **P7** Canais Sociais Concluído (§1.11) |

---

## 3. Linha do tempo resumida (o que já está feito — não refaça)

- **Fases 0–L3 / K / V23**: ver `PROGRESS.md` (setup Pix+produto real, 7 estágios, 12 plays, Scout, ROI, anti-fake, security-audit 31/31, dashboard `/dash`, simulators).
- **2026-09-24 (rodada do checklist)**:
  1. Deploy `d5de4457` (chunking `###`-only, `faq_candidates`, fatos REGRAS/PROIBICOES).
  2. Índice Vectorize limpo (37 órfãos deletados, re-upload → 22 frescos) — procedimento no runbook.
  3. Smokes ao vivo 10/10 + 12 personas 17/17; probes de conteúdo (5.11/5.6/5.12/5.9).
  4. `AGENTS.md` criado (checklist vivo); `PROGRESS.md` declarado legado.
  5. Pendências P2 (security-audit 31/31), P3 (postdeploy-smoke **corrigido em 3 bugs de script**), P7 (smokes movidos p/ repo), P8 (índice 22/22), P9, P10 (runbook), P11 — todas concluídas.
  6. Sessão "Avançando em chat": 12 tarefas verificadas 12/12 (botões, FSM por chat, contrato LLM, comandos, tom, handoff, latência).
  7. **Deploy `6f296d08`** (esta sessão): suporte a grupos + FASE M real — detalhes na §4.

---

## 4. ENTRELINHAS — o que só existe na memória da sessão

> Cada item: **o que é**, **onde está no código/arquivo**, **o que verificar**.

### 4.1 Áudio/STT nunca foi provado ao vivo (RESOLVIDO)
- ~~O dono relatou na conversa: **"o Telegram não leu o áudio"**~~ **Resolvido**: O usuário enviou um screenshot mostrando o bot transcrevendo o áudio perfeitamente e enviando uma resposta de RAG. A transcrição chamou a intenção correta, mas retornou os cabeçalhos brutos da KB (este bug do chunkText foi corrigido hoje, garantindo que cabeçalhos sejam retirados no envio final).
- **O que foi feito**: O bug de RAG que vazava `## 5. BIBLIOTECA` foi consertado no código e com os testes de `chunkText` devidamente ajustados (`test-phase3-kb.js`). A transcrição via whisper no Cloudflare Workers AI está confirmada funcionando em produção.

### 4.2 FASE M: por que a rodada anterior era lixo e o que foi corrigido
- **Sintoma antigo**: replies como "Soy ChatGPT" / conteúdo alucinado (Game of the Goose) — porque o simulador mandava **só a fala do lead** (`llm-providers.js`, chamada antiga `generateWithProviders(persona.messages[t], ...)`) sem papel do vendedor; o modelo respondia como ele mesmo.
- **Fix 1 (persona)**: `SIM_AGENT_PERSONA` + `buildSimAgentPrompt` em `scripts/llm-providers.js` (~linha 208) — injeta papel, fatos reais (R$97, Pix/12x, garantia 7d, link oficial), regras PT-BR ≤2 frases. `runProviderSimulation` agora envia `buildSimAgentPrompt(...)`.
- **Fix 2 (vazias)**: `max_tokens` **300 → 800** nas 4 chamadas de LLM (`llm-providers.js:84,96,123,135`). Motivo: `openai/gpt-oss-20b` é reasoning e gastava ~298/300 tokens pensando → resposta vazia (6/25 no primeiro run). Com 800: **1/100 vazias** (`diego-iniciante` turno 1 — reasoning 798/800, ainda estourou o orçamento; ver 4.3).
- **Evidência envenenada resetada**: `simulator/batch-state.json` (6 personas com respostas ruins) foi zerado e `simulator/cache-real.json` apagado **antes** do run limpo. Hoje: 20 personas / 100 turns / providers `{"groq":100}`.
- **Artefatos**: `simulator/batch-state.json` (acumulado), `simulator/cache-real.json` (chaves = sha256(seed+persona+turn+prompt)), `simulator/run-log.json`, `simulator/report.json` (final), logs dos batches em `%TEMP%\chatpay-m-batch*.log` (temporário, pode sumir).

### 4.3 O gate da FASE M tem DOIS níveis — não confunda
- **Gate de chamadas reais** (o que passou): linha `FAIL: X chamadas reais novas; mínimo exigido: 20` (`phase-e-simulator.js:403`). Só conta chamadas **novas** (`cache_hit` → `calls: 0`, ver `telemetry()` em `llm-providers.js:70`). Default `--min-real-calls` = **20 por execução** → cada batch de 5 personas (25 calls) passa sozinho. Último batch: `real_provider_calls: 25, gate_pass: true`.
- **Gate de BANDAS** (não passou, é esperado): `report.json` final tem `gate_pass: false` e `win_rate: 0` porque `validateBandGates`/conversão do grafo E2 estão em 0% — **isso é escopo do P5 (FASE I4)** e a regra é *não alterar bandas sem evidência + aprovação do arquiteto*. O `win_rate: 0` também aparece na rodada **mock** do predeploy (pré-existente, não regressão).
- `personas_run: 23` no relatório = 20 personas de vendas + adversariais fixos (`phase-e-simulator.js:149–154`, `troll-never-buyer`/`never-buyer`). Não é estado corrompido.

### 4.4 Cadeia de providers (LLM externo do simulador)
- Ordem: `PROVIDER_ORDER = ['cerebras','groq','openrouter','gemini','github_models']` mas é **re-sortida por probe** a cada run (`phase-e-simulator.js:360`): quem respondeu 200 primeiro.
- **Cerebras: probe 200 mas inferência 402** (quota) — o probe bate em `/v1/models`, não gasta quota. Falha rápido → cai para Groq (funciona; 429 eventual com retry `[5s, 30s, 120s]` — `llm-providers.js:156`).
- **NUNCA passe `--provider X`** numa rodada real: vira `forceProvider` e a cadeia vira `[X]` só (`llm-providers.js:165`) — perde o fallback. Use `--require-real` sem `--provider` (fica `auto`).
- Log enganoso: `reference_report: "unavailable (OPENROUTER_API_KEY ausente)"` aparece mesmo com a chave presente — é um ternário (`phase-e-simulator.js:408-410`) que só grava `reference-report.json` quando `provider=openrouter`. **Não** prova chave ausente.
- `scripts/secret-loader.js` lê `process.env` (+ arquivo via `CHATPAY_SECRETS_FILE`, precisa de caminho absoluto).

### 4.5 Grupos Telegram (deploy atual) — como funciona de verdade
- **O webhook não filtra `chat.type`** — privado, `group` e `supergroup` caem no mesmo fluxo; sessão por `chat.id` (negativo em grupo) via `bindTgSession`.
- `isStart` (`worker.js:2891`) aceita `/start@NomeDoBot <dom>` — obrigatório porque em grupos o Telegram/completa do usuário manda com `@bot`.
- **Dedup de bolha desativado em grupo** (`worker.js:~3351`, `isGroupChat`): sem isso, dois clientes perguntando "qual a garantia?" em 10 min → o segundo não recebia nada (chave `tg:lastreply:{chatId}`, 600s). Privado **mantém** o dedup — G12 (phase4) e testes dependem dele.
- Testes: `test-phase1.js` G1/G2 (últimos asserts) — bind via `/start@ChatPayteste_bot` e "segunda idêntica não vem `deduped`".
- **Probe ao vivo em prod** (feita nesta sessão): supergroup fake `-100777666555` → `start_bound` + `domain: chatpay.oficial` ✓; 2× `qual a garantia?` → nenhuma `deduped` ✓; `send_failed` esperado (chat não existe). **Resíduo**: chave `session:-100777666555` no Redis (TTL 90d, inofensiva).
- **Pré-requisitos no Telegram real (só o dono faz)**: criar supergrupo → bot **admin** → BotFather `/mybots` → Group Settings → **`/setprivacy` Disable** (senão o bot não recebe mensagens de terceiros) → no grupo enviar `/start chatpay.oficial`.

### 4.6 Limitação conhecida da FSM em grupo (não corrigida de propósito)
- FSM/tags/handoff são **por chat** (`tg:state:{chatId}`, `tg:tags:{chatId}`, `tg:handoff:{chatId}`), não por usuário. Em grupo: **2 clientes distintos irritados (1 mensagem cada) podem disparar `handoff_irritado` para a sala inteira** e pausar o bot para todos até `/retomar`.
- Por que ficou assim: corrigir exige mudar o schema de chaves para `{chatId}:{userId}` e refazer testes phase2 — decisão de **fase de teste**, documentada aqui para você avaliar se vale refatorar (provavelmente sim, antes de escalar o canal).

### 4.7 LLM do bot em produção (o que responde os clientes)
- **Não** é Groq/OpenRouter: é **Workers AI** — `callLLM` (`worker.js:1299`) → `llm()` (`worker.js:1259`) → `env.AI.run(LAST_AI_MODEL)`. Binding `env.AI` confirmado no deploy.
- Fallback determinístico (menu/FAQ) quando falha; timeout **8s** (`TG_LLM_TIMEOUT_MS`), 1 retry, contrato `{intent, reply}` com retry (`worker.js:3265`). Loop de tools ≤2 iterações, whitelist (`check_pix|preco|checkout_link|faq_search|handoff_humano`).
- Fast-paths sem LLM: `fastTelegramPriceReply`/`fastTelegramProductReply` (latência).
- Hierarquia de conteúdo §10: **REGRAS/PROIBICOES do lojista > catálogo > KB**; `buildTelegramFacts` injeta regras antes. KB mestre `docs/kb/MAFEL-KB.md` é autoridade 2ª.

### 4.8 Como os testes "mentem" (só a sessão sabe)
- Os testes rodam num **harness in-process** (`test/harness.js`): `makeRequest` finge HTTP, MiniRedis finge Redis, `faults.*` injeta falhas. **Provam lógica, não produção.**
- Validação real = os 3 scripts ao vivo: `scripts/smoke-live.js`, `scripts/smoke-12-personas.js` (contra prod, chat `998009360`) e `scripts/postdeploy-smoke.ps1`.
- Smokes ao vivo exigem **sequência única em processo único** (o script cuida disso com `seq = Date.now()`); não rode dois smokes em paralelo.
- Harness `faults.aiRunner` é opt-in via getter — testes que "transcrevem áudio" ou "LLM respondeu" são simulações.

### 4.9 Três bugs de script que já foram corrigidos (não reintroduza)
- PowerShell 5.1 **lança exceção em status 4xx** em `Invoke-WebRequest` → `Get-Json` do `postdeploy-smoke.ps1` agora trata (EAP=Stop converte stderr nativo de processos em exceção — cuidado com `npx`).
- `/api/agent-graph` aceita shape `agentes` **ou** `pipeline` (o smoke quebrava).
- Parse de version-id do wrangler pega a **úLTIMA** `Version(s):` da lista cronológica (com EAP=Continue durante o npx, senão a exceção aborta).

### 4.10 Regras de ambiente (PowerShell 5.1)
- **Sem `&&`** (não existe): usar `cmd1; if ($?) { cmd2 }`. Sucesso via `$LASTEXITCODE`/`$?`.
- `node --check` funciona nos `.js` (ESM sem `"type":"module"` no package — warnings de reparse são normais, ignorar).

### 4.11 Segredos e padrões proibidos
- Proibidos no repo (o predeploy checa): `openrouter.ai`, `generativelanguage.googleapis.com`, `api.groq.com`, literais `*__API_KEY`. Nunca commitar `.env`, `.env.local`, `*.pem`.
- 6 secrets no wrangler (verifique com `npx.cmd wrangler secret list --name midas-core`).
- `CHATPAY_TOKEN` (len 183) e as chaves de provider existem **no seu shell** — não usem dentro de código commitado; os scripts leem via `loadLabSecrets`.

### 4.12 Redis — mapa de persistência (worker sem fs/env.KV)
- `session:{chatId}` (bind domínio, 90d) · `loja:{dom}` · `kb:{dom}` (espelho da KB) · `swarm:prods:{dom}` · `faq_candidates:{dom}` (LPUSH+LTRIM 100+TTL 30d) · `tg:lastreply:{chatId}` (dedup 600s, privado) · `tg:state:{chatId}` · `tg:tags:{chatId}` · `tg:handoff:{chatId}` (TTL 7200) · `tg:tx:{chatId}` · `pix:tx:{txid}` (verdade de pagamento) · `rl:tg:start:{chatId}` (5/min) · `tg:seen:{update_id}` (idempotência) · `channel:config:{ch}:{dom}` · `queue:telegram` (drain com lock).
- Verdade de pagamento **só** do Redis: "paguei" nunca confirma sem tx `status: 'paid'`.

### 4.13 Outros detalhes fáceis de perder
- **Link policy**: pagos/objetivo levam link `&p=` (`buildPayLink`); garantia/preço-info/produto/FAQ **nunca** levam. Gate final `applyLinkPolicy` antes de enviar (`worker.js:3348`).
- **Dedup de evento**: `recentLeadEvents` 1s (`worker.js:1451`), idempotência `tg:seen` por `update_id`.
- **Rate limits**: `/start` 5/min por chat; envio via `sendTelegramLimited` (25/s, fila `queue:telegram` com lock de drain).
- **Anti-injeção**: `detectTgInjection` (`worker.js:540`, usado em `:3113`) → `injection_blocked`.
- **Handoff irritado**: 2 mensagens com padrão irritado → `handoff_irritado` (contatos `wa.me/5511932270717`, `t.me/Tokenizeassets`); `/retomar` limpa.
- **Deep link**: `https://t.me/{bot}?start={domain}` (gera `generateTgDeepLink`/QR).
- **`obs.:` sobre o AI Agents para aprimorar** (sua frente): `runAgentPipeline` + `classifyIntentAdvanced` (taxonomia 1055 padrões), plays/bandit (`test-v23`), `honesty judge` (bloqueia escassez falsa), Scout (desconhecidos), `competitorAnalyzer`, stages do arco de venda. Os testes v2x são **static/behavioral via harness** — há margem grande para testes mais reais e para qualidade de reply (ex.: resposta vazia ainda ocorre em 1/100).

---

## 5. Mapa do código (hotspots — comece por aqui)

| Local | O que é |
|-------|---------|
| `worker.js:770-820` | `parseTgStartPayload` / `bindTgSession` / `resolveTgSession` / `allowTgStart` |
| `worker.js:695` | `transcribeTelegramAudio` (STT whisper via `env.AI`) — ver 4.1 |
| `worker.js:1259/1299` | `llm()` / `callLLM` (Workers AI + router/fallback) |
| `worker.js:2810+` | webhook Telegram (sem filtro de `chat.type`) |
| `worker.js:2891` | `isStart` (aceita `@bot`) + comando `/start` |
| `worker.js:2897-3102` | callbacks + comandos `/menu /preco /garantia /pagamento /humano /id /retomar` |
| `worker.js:3113/3265` | anti-injeção no texto + path LLM (contrato `{intent, reply}`, timeout 8s) |
| `worker.js:3348-3373` | `applyLinkPolicy` final → dedup (grupo pula) → `sendTelegramLimited` |
| `worker.js:3845` | exports p/ testes (`transcribeTelegramAudio` etc.) |
| `scripts/llm-providers.js` | cadeia de providers + `buildSimAgentPrompt` + cache + retries |
| `scripts/phase-e-simulator.js` | CLI FASE M: `--seed --require-real --batch --min-real-calls --max-turns` (§310–416) |
| `scripts/predeploy-check.ps1` | **gate obrigatório** antes de qualquer deploy |
| `scripts/security-audit.ps1` / `postdeploy-smoke.ps1` | 31/31 · 6/6 |
| `scripts/smoke-live.js` / `smoke-12-personas.js` | smokes reais (10 · 17 asserts) |
| `scripts/upload-kb.ps1` | upload de KB (UTF-8, valida `chunks>=2`) |
| `test/harness.js` | harness in-process (MiniRedis, faults, makeRequest) |
| `simulator/batch-state.json` + `cache-real.json` | **evidência da FASE M — não apague sem motivo** |

---

## 6. Processos (não reinvente)

```powershell
# 1) sintaxe      node --check worker.js
# 2) regressão    powershell -ExecutionPolicy Bypass -File scripts\predeploy-check.ps1   (precisa EXIT=0)
# 3) deploy       npx.cmd wrangler deploy --name midas-core
# 4) pós-deploy   scripts\postdeploy-smoke.ps1 ; scripts\security-audit.ps1
# 5) ao vivo      node scripts\smoke-live.js ; node scripts\smoke-12-personas.js
# 6) índice (só se KB mudar)  wrangler vectorize list-vectors kb-midas-core  (procedimento no runbook)
# 7) FASE M       node scripts\phase-e-simulator.js --seed 20260910 --require-real --batch 5   (sem --provider!)
```

- Deploy **só** com predeploy PASS. Anotar Version ID novo e rollback no runbook + `AGENTS.md`.
- Smokes ao vivo: sequência única, processo único.

---

## 7. O que falta (além do que o AGENTS.md lista)

1. **P1 — validação visual do dono** no Telegram real (bolhas, botões, handoff, dedup). (Teste de áudio foi concluído).
2. **Canal em grupo ao vivo**: dono cria o grupo + `/setprivacy` + `/start chatpay.oficial` (4.5) → aí rodar smoke no grupo.
3. **4.6 — FSM por usuário em grupo** (refatoração recomendada antes de escalar).
4. **4.1 — provar STT real**: ~~provável bug real relatado~~ (Resolvido! STT provado em produção, transcrição enviou intenção para RAG KB e a resposta foi dada. Bug de headers no RAG corrigido).
5. **P5 — FASE I4**: bandas N4–N10 em 0%; não mexer sem evidência/aprovação; separar o gate de bandas do gate de chamadas reais.
6. **P6 — WhatsApp**: placeholders no `/dash` (`wa_phone_id`, `wa_access_token`, `webhook_verify_token`).
7. **Qualidade dos AI Agents** (frente do revisor): vazio 1/100 na FASE M; identidade vazava antes (4.2); replies por vezes longas apesar da regra "≤2 frases"; `win_rate 0` precisa de análise honesta (4.3) — **sem forçar métrica**.
8. **Canais Sociais Midas (Instagram/YouTube/TikTok)**: endpoints `channel-config` existem (32 testes), **sem credenciais** — próximos a configurar para testarmos o ChatPay neles (logo após consolidar as refatorações atuais e Telegram redondo).

---

## 8. Regras inegociáveis do dono (violou = retrabalho)

1. **ZERO teste fake/mock/teatro** em validação de aceitação — simulador de banda é uma coisa; prova de entrega é LLM real + Telegram real.
2. **Honesty**: sem dado real = sem número; "paguei" nunca confirma sem prova no Redis; sem link onde a política proíbe.
3. **Segredos**: nunca commitar (4.11).
4. Todo deploy passa por `predeploy-check.ps1` **PASS**.
5. **Ao terminar qualquer seção: atualizar `AGENTS.md`** (mover item de seção, nunca apagar). `PROGRESS.md` = legado.
6. Hierarquia de conteúdo §10 (regras do lojista > catálogo > KB).

---

## 9. Checklist de revisão (perguntas que você deve responder)

- [ ] `node --check` + `predeploy-check` saem EXIT=0 **hoje**? (se não, descubra o que mudou no ambiente.)
- [ ] `wrangler deployments list` bate com a §2? (cronológico ascendente — o mais recente é o **último** da lista.)
- [ ] Índice Vectorize ainda tem 22 vetores? (list-vectors)
- [ ] Consegue reproduzir o pipeline real da FASE M e o gate passar? (§6.7)
- [ ] Entendeu a diferença entre os dois gates (4.3) sem querer "consertar" o `win_rate`?
- [ ] Já testou áudio real (4.1) e sabe dizer se STT funciona em prod?
- [ ] Já leu 4.5/4.6 e tem opinião sobre refatorar FSM por usuário?
- [ ] Propôs melhorias concretas nos AI Agents com evidência (não achismo)?
- [ ] Atualizou `AGENTS.md` com o que fez?

---

## 10. Cuidado — o que não mexer sem necessidade

- `simulator/batch-state.json`, `simulator/cache-real.json`, `simulator/report.json` = **evidência da FASE M** (apagar invalida a prova; só resetar com motivo documentado).
- Índice Vectorize (22 vetores) — nunca recriar; limpeza só pelo procedimento do runbook.
- Rollback disponível: `d5de4457` (só com motivo registrado).
- Não alterar **bandas/gates** do simulador (P5, precisa do arquiteto).
- Não remover o dedup de privado (quebra G12/phase4) nem o `chat.id`-por-chat do bind.
- Não commitar nada da §4.11; não usar `--provider` em rodada real (4.4).

---

*Documento gerado em 2026-09-24 pela sessão que fez o deploy `6f296d08` + FASE M real. Quando algo da §4 for verificado/corrigido, mova o item para `AGENTS.md §1` e marque aqui como resolvido.*
