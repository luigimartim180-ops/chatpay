# ChatPay V22.1 — MIDAS CORE (HUNTER CONTEXTUAL + AGENT GRAPH + MULTI-MODEL)

Worker Cloudflare em producao: https://midas-core.novoronaldo-m.workers.dev

## Estado do setup (07/09/2026)

- **Deploy ativo**: Version ID `86a31c92-0826-4c64-8bd2-acbf8fec06a7`
- **Cron trigger**: `0 * * * *` (toda hora, espelhado do dashboard Cloudflare)
- **Worker**: `midas-core` na conta `OWNER_EMAIL configurado via ambiente`
- **Account ID**: `79cfccbf78bb446fb04fbdbb8c5663e4`

## Infraestrutura

| Servico       | Endpoint                                    | Obs                                        |
|---------------|---------------------------------------------|--------------------------------------------|
| Redis Upstash | `current-pheasant-114427.upstash.io`        | Banco "nucleo de Midas", sa-leste-1, free  |
| Resend        | `api.resend.com`                            | Email: OWNER_EMAIL configurado via ambiente             |
| Cloudflare AI | binding `AI` no wrangler.toml               | LLaMA/Mistral/Qwen + BAAI BGE Embeddings   |
| TiDB          | Configurar via `/set-tidb?key=...`          | URL guardada no Redis                      |
| Mercado Pago  | Configurar via `/set-mp?key=...`            | Token guardado no Redis                    |

---

## 🎯 Hunter V22.1: Detecção de Intenção Contextual em Escala

### 1. Taxonomia Completa de Intenção (1055 variações)
Arquivo `intent-taxonomy.json` com 8 categorias especializadas:
- **Intenção Direta de Compra** (235+ variações): "quero comprar", "qual o valor", "passa o pix", "garantir o meu", etc.
- **Sinais de Interesse em Lives** (289+ variações): "eu", "1", "sim", "topo", "🙋", "🔥", "🚀", etc.
- **Intenção Indireta & Dúvidas** (191+ variações): "como funciona", "tem garantia", "serve para mei", "o acesso é vitalício", etc.
- **Detecção de Objeções** (101+ variações): "tá caro", "sem limite", "vou pensar", "falar com meu sócio", etc.
- **Regionalismos Brasileiros** (74+ variações): "bah", "tri legal", "massa demais", "topzeira", "é nóis", "arretado", etc.
- **Erros Comuns de Digitação** (76+ variações): "kero", "qro", "conpro", "preso", "likn", "pixx", etc.
- **Emojis de Alta Conversão** (49+ emojis): 💰, 🤑, 🛒, 🎯, 🔥, ⚡, 🚀, ✅, 👍, 🙋‍♂️, etc.
- **Gatilhos de Perguntas do Apresentador** (40+ variações): "quem quer?", "digita eu", "comenta 1", "levanta a mão", etc.

### 2. 5 Modos Operantis Contextuais (`detectMode`)
- `LIVE_SELLING`: Detecta URLs de live (/live, /stream) ou metadata de streaming. Sensibilidade alta a sinais curtos ("eu", "1", emojis).
- `DM_CONVERSATION`: Para Instagram Direct e WhatsApp 1:1. Responde apenas com confiança > 0.70 e personalização.
- `GROUP_CHAT`: Para grupos de WhatsApp/Telegram. Anti-spam rigoroso com limite de mensagens por hora.
- `COMMENT_TO_BUY`: Para comentários públicos em posts do Instagram/TikTok. Prioriza resposta via DM automática.
- `QA_SESSION`: Detecta perguntas de hosts em sessões de Q&A para tirar dúvidas e apresentar a oferta.

### 3. Sistema de Aprendizado por Segmento & Dogfooding
- **Memória de Padrões por Nicho**: Armazenamento em `swarm:intent_patterns:{segment}` com feedback loop de respostas vencedoras.
- **Bandit Multi-Armed**: Seleção de templates de alta conversão adaptados para cada canal.
- **Dogfooding (`chatpay.oficial`)**: O próprio ChatPay vende ChatPay em lives e grupos com métricas públicas de prova social via `/api/public-stats`.

---

## 🏛️ Pilares da Arquitetura V22

1. **Multi-Model LLM Router (`callLLM`)**: Suporte a `workers_ai`, `openai`, `anthropic`, `custom` com fallback automático após 2 falhas e rate limit de 10 req/min.
2. **Agent Graph & Orchestrator (`runAgentPipeline`)**: Pipeline sequencial de agentes (`objectionHandler`, `proofGenerator`, `timingOptimizer`, `competitorAnalyzer`, `upsellArchitect`) com timeout de 10s.
3. **Memory Layer & Semantic RAG (`saveMemory`, `rememberMemory`)**: Dual-write em TiDB e Redis com busca por similaridade de cossenos Top-3.
4. **Tool Calling (`executeTool`)**: Chamadas de ferramentas com validação rígida de whitelist (`playbook.tools`) e timeout de 5s.
5. **Webhooks Seguros com HMAC-SHA256 (`triggerWebhook`)**: Assinatura criptográfica Web Crypto e 3x retries com backoff.

---

## Novos Endpoints da API V22 & V22.1

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/public-stats?d=...` | Estatísticas públicas para prova social em tempo real (Dogfooding). |
| `GET/POST` | `/api/hunter-mode` | Consulta e configuração do Modo Operante do domínio. |
| `GET/POST` | `/api/intent-taxonomy` | Consulta e inserção de novas palavras-chave na taxonomia. |
| `GET` | `/api/hunter-analytics-v2` | Analytics avançado com segmentação por categoria e modo. |
| `GET` | `/api/agent-graph` | Retorna o grafo de pipeline dos agentes. |
| `GET/POST` | `/api/memory` | Gravação e busca semântica RAG em memória. |
| `GET` | `/api/playbook-suggestions` | Sugestões evolutivas do Analyst diário. |

---

## Dashboard real de staging

Use um checkout autenticado pelo Wrangler e execute `wrangler dev --remote --port 4173`. Abra `/dash?token=<JWT-de-teste>` no endereço local do Wrangler. O dashboard usa GETs somente leitura ao Worker real, oculta o JWT na interface e bloqueia formulários e ações de escrita, pagamentos, envios e webhooks. Sem JWT válido, mostra estado de autenticação/API e não substitui métricas por dados de demonstração. A estimativa de custo interna não representa a quota Neurons nem a fatura Cloudflare. Não cole nem grave o JWT no chat ou no repositório.

`npm run preview` continua sendo um harness local deliberadamente sintético e sempre exibe um banner de preview; ele não representa staging nem métricas reais.

## Preview visual local

```bash
npm run preview
```

Abre o dashboard em modo demonstrativo local (porta 4173). O preview usa o harness e dados sintéticos; não consulta Redis/Telegram, não chama modelos externos e não representa métricas reais.

## Testes & Validação Automatizada

```bash
# Regressão local offline: verifica sintaxe e executa suites com credenciais removidas
npm test
```

`npm test` não chama Cloudflare, Redis, Telegram nem provedores de LLM. É um gate local baseado no harness; não substitui os smokes reais. O gate de deploy `scripts/predeploy-check.ps1` também exige PowerShell e Wrangler autenticado para conferir os secrets de produção. Smokes ao vivo devem ser executados separadamente, em sequência e com autorização do responsável.

## Swarm de IA e modelos

O Worker usa roteamento **quality-first com fallback limitado** em vez de escolher um modelo aleatório por chamada. Prioridade padrão (IDs já permitidos no código):

1. `@cf/meta/llama-3.3-70b-instruct-fp8-fast`
2. `@cf/qwen/qwen3-30b-a3b-fp8`
3. `@cf/meta/llama-4-scout-17b-16e-instruct`
4. `@cf/openai/gpt-oss-20b`
5. `@cf/mistralai/mistral-small-3.1-24b-instruct`
6. `@cf/meta/llama-3.2-3b-instruct`

Por padrão tenta até três modelos por chamada. A ordem pode ser ajustada com `AI_MODEL_ORDER`; tarefas específicas aceitam `AI_MODEL_ORDER_REPLY`, `AI_MODEL_ORDER_QUALIFICATION`, `AI_MODEL_ORDER_CLASSIFICATION`, `AI_MODEL_ORDER_REVIEW` e `AI_MODEL_ORDER_CREATIVE`, permitindo separar geração, qualificação, classificação e crítica do swarm. Use apenas IDs permitidos em `worker.js`. `AI_MAX_ATTEMPTS` limita tentativas (padrão 3) e `AI_MAX_TOKENS` ajusta a saída. A ordem é uma política de capacidade configurada, não um benchmark ao vivo; disponibilidade e desempenho real dependem do binding do Workers AI.

Para provedores externos configurados no playbook, `llm_model` tem precedência; alternativamente, configure `OPENAI_MODEL`, `ANTHROPIC_MODEL`, `DEEPSEEK_CHAT_MODEL` ou `DEEPSEEK_REASONER_MODEL`. O fallback público do Pollinations fica desligado por padrão porque enviaria prompts a um terceiro; só é habilitado explicitamente com `ALLOW_PUBLIC_LLM_FALLBACK=1`.

## Sandbox de staging

Defina `SANDBOX_MODE=true` como variável do Worker de staging antes de qualquer teste. `GET /api/sandbox-status` responde mesmo com configuração incompleta e retorna apenas nomes ausentes, nunca valores. `sandboxReady` exige sandbox ativo, Redis configurado e binding Workers AI. No sandbox, `REDIS_URL`, `REDIS_TOKEN`, `MIDAS_SECRET` e `JWT_SECRET` são obrigatórios; `RESEND_KEY` e `TARGET_EMAIL` não são necessários porque e-mails são bloqueados. Fora do sandbox, os seis são obrigatórios.

Nesse modo, o Worker bloqueia HTTP externo (exceto Redis), gravações TiDB e criação/confirmação de pagamentos; canais registram `sandbox_would_send`. O roteador força Workers AI mesmo se o playbook escolher outro provedor, com uma tentativa e até 256 tokens por chamada. Isso não é um limite total de Neurons nem garante custo zero.

O runner real, `scripts/run-staging-e2e.mjs`, consulta o status remoto antes de começar e então pede ao Workers AI para gerar mensagens de um cliente sintético, enquanto chama o pipeline real do Worker, em passos de até 10 turnos. Ele aborta quando o sandbox/binding não está pronto, em falhas/quota de AI ou ao atingir o limite de 64 chamadas Workers AI por execução. Nenhuma mensagem é enviada nem colocada em fila de canal: a resposta do pipeline volta diretamente ao runner, e toques futuros/fluxos de aprovação são suprimidos para leads sintéticos; nenhum pagamento é criado. O runner exige confirmações locais explícitas (`CHATPAY_CONFIRM_STAGING_REDIS=YES` e `CHATPAY_CONFIRM_ZERO_COST=YES`) e um JWT de teste em `CHATPAY_TOKEN`; esses valores não devem ser enviados no chat nem gravados no repositório.

Antes de executar, confirme que o Redis é isolado para staging e que a conta não pode cobrar excedente: o limite de 256 tokens por chamada e o teto de 64 chamadas não equivalem a um teto de Neurons. Após o deploy, mantenha o JWT de um domínio de teste apenas no ambiente local, defina `CHATPAY_CONFIRM_STAGING_REDIS=YES` e `CHATPAY_CONFIRM_ZERO_COST=YES` somente depois das confirmações, e execute `node scripts/run-staging-e2e.mjs`. O script verifica `/api/sandbox-status` antes de iniciar; não repete automaticamente chamadas com resultado de transporte incerto. O guard é aplicado no Worker; não use o widget embarcado ou scripts executados diretamente no navegador.

## Segurança

Nunca commitar `REDIS_TOKEN`, `RESEND_KEY`, `MIDAS_SECRET`, `JWT_SECRET`, tokens MP ou `BOT_TOKEN` do Telegram. Use variáveis de ambiente/Cloudflare Secrets; não exiba o conteúdo de arquivos de segredo nos logs. Se um token já apareceu em arquivo ou histórico Git, revogue-o no provedor e gere um novo — apagar o arquivo atual não remove cópias do histórico.
