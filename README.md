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

Defina `SANDBOX_MODE=true` como variável de texto do Worker de staging antes de qualquer teste. `GET /api/sandbox-status` responde mesmo quando a configuração geral está incompleta e devolve apenas nomes ausentes, nunca valores: `sandboxReady` só será `true` com sandbox ligado, Redis configurado e binding Workers AI presente. `e2eRunnerAvailable` permanece `false` até o runner autônomo real ser implementado e implantado. No sandbox, `REDIS_URL`, `REDIS_TOKEN`, `MIDAS_SECRET` e `JWT_SECRET` continuam obrigatórios; `RESEND_KEY` e `TARGET_EMAIL` deixam de ser pré-requisitos porque os envios de e-mail são bloqueados. Fora do sandbox, os seis continuam obrigatórios. Nesse modo, o Worker bloqueia requisições HTTP externas (mantendo somente Redis configurado), impede gravações TiDB e confirmações/criações reais de pagamento, registra ações de canal como `sandbox_would_send` e permite Workers AI com no máximo uma tentativa e 256 tokens por chamada. Mesmo que o playbook selecione OpenAI, Anthropic, DeepSeek ou outro provedor, o roteador usa exclusivamente o binding Workers AI no sandbox. O fallback público do Pollinations também fica bloqueado. O limite de 256 tokens é por chamada, não por execução completa; ele não substitui a verificação da franquia nem um teto global de chamadas.

`SANDBOX_MODE` não garante custo zero de Workers AI: confira a cota e o uso reais da conta antes de executar. O guard é aplicado no Worker; não use o widget embarcado ou outros scripts executados diretamente no navegador para este teste.

## Segurança

Nunca commitar `REDIS_TOKEN`, `RESEND_KEY`, `MIDAS_SECRET`, `JWT_SECRET`, tokens MP ou `BOT_TOKEN` do Telegram. Use variáveis de ambiente/Cloudflare Secrets; não exiba o conteúdo de arquivos de segredo nos logs. Se um token já apareceu em arquivo ou histórico Git, revogue-o no provedor e gere um novo — apagar o arquivo atual não remove cópias do histórico.
