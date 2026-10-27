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

## Testes & Validação Automatizada

Para validar a integridade de todas as suites de testes:

```powershell
# 1. Checagem de sintaxe
node --check worker.js

# 2. Rodar suite V22.1 (Hunter Contextual & Modos Operantis — 54 testes)
node test-v22.1.js

# 3. Rodar suite V22 (Agent Graph, Memory & Multi-Model — 56 testes)
node test-v22.js

# 4. Rodar suite legada V21
node test-v21.js
```

## Seguranca

Nunca commitar: `REDIS_TOKEN`, `RESEND_KEY`, `MIDAS_SECRET`, `JWT_SECRET`, tokens MP.
Use variáveis de usuário/máquina ou `CHATPAY_SECRETS_FILE` apontando para
`C:\secrets\chatpay-secrets`; use `wrangler secret` para produção.
