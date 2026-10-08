# 🚀 Guia Completo de Setup do ChatPay (Para Clientes)

> **Para quem é este guia:** Qualquer lojista que queira configurar o ChatPay do zero — loja, produtos, Pix, IA (RAG/KB), Swarm de Agentes e Canais Sociais (Instagram, YouTube, TikTok). **Não precisa ser programador.**

---

## 📋 O que você vai precisar ANTES de começar

| Item | Obrigatório? | Onde conseguir |
|------|--------------|----------------|
| **Acesso ao Dashboard ChatPay** | ✅ Sim | Fornecido no onboarding: `https://midas-core.novoronaldo-m.workers.dev/dash` |
| **Senha administrativa** | ✅ Sim | Enviada por email/Telegram no onboarding |
| **Domínio da loja definido** | ✅ Sim | Ex: `sualoja.chatpay.oficial` (criado pela equipe) |
| **Conta Pagar.me / Mercado Pago / Stripe** | ✅ Sim (para Pix) | Cadastre em [pagar.me](https://pagar.me), [mercadopago.com.br](https://mercadopago.com.br) ou [stripe.com](https://stripe.com) |
| **Conta Meta for Developers** | ✅ Sim (para Instagram) | [developers.facebook.com](https://developers.facebook.com) |
| **Conta Google Cloud** | ✅ Sim (para YouTube) | [console.cloud.google.com](https://console.cloud.google.com) |
| **Conta TikTok for Developers** | ✅ Sim (para TikTok) | [developers.tiktok.com](https://developers.tiktok.com) |

> ⏱️ **Tempo total estimado:** 45–60 min na primeira configuração completa.

---

## 🏗️ 1. Configuração da Loja e Produtos

### 1.1 Acesse o Dashboard
- URL: `https://midas-core.novoronaldo-m.workers.dev/dash`
- Insira a senha administrativa

### 1.2 Defina o Domínio da Loja
- No menu lateral: **Configurações** → **Loja**
- **Domínio:** seu identificador único (ex: `chatpay.oficial`, `sualoja.com.br`)
- **Nome da Loja:** nome exibido para clientes
- **Nicho:** ex: "Infoprodutos", "E-commerce moda", "Serviços digitais"
- **Slogan:** frase curta de posicionamento

### 1.3 Cadastre o Produto Principal
1. Menu: **Produtos** → **+ Novo Produto**
2. Preencha:
   | Campo | Exemplo | Dica |
   |-------|---------|------|
   | **Nome** | `ChatPay Trial 30d` | Nome atrativo |
   | **Descrição** | `30 dias de acesso completo...` | Curta, benefícios claros |
   | **Preço (centavos)** | `9700` | = R$ 97,00 |
   | **Moeda** | `BRL` | Padrão Brasil |
   | **Benefícios** | `["Bot Telegram com IA", "Pix instantâneo", "Suporte 24/7"]` | 3–5 itens |
   | **Garantia (dias)** | `7` | Padrão: 7 |
   | **Texto da Garantia** | `Se não gostar, devolvemos 100% em até 7 dias` | Copia para KB |
3. **Salve** → O sistema gera automaticamente o **Link de Checkout Seguro**

> 🔗 **Link de Checkout:** `https://midas-core.novoronaldo-m.workers.dev/pay?d=SEU_DOMINIO&p=ID_PRODUTO`
> A IA e os botões enviarão esse link no momento exato da intenção de compra.

---

## 💰 2. Configurando o Pagamento (Pix)

O ChatPay gera códigos Pix individuais no chat e monitora pagamento em tempo real via Redis.

### 2.1 Obtenha as credenciais do Gateway
| Gateway | Onde pegar | Chaves necessárias |
|---------|------------|-------------------|
| **Pagar.me** | Dashboard Pagar.me → Configurações → API Keys | `api_key`, `encryption_key` |
| **Mercado Pago** | [developers.mercadopago.com](https://developers.mercadopago.com) → Suas integrações | `access_token`, `client_id`, `client_secret` |
| **Stripe** | Dashboard Stripe → Developers → API Keys | `secret_key`, `publishable_key` |

### 2.2 Configure no Dashboard ChatPay
1. Menu: **Pagamentos / Gateway**
2. Selecione seu gateway
3. Cole as chaves nos campos correspondentes
4. **Salve credenciais**

### 2.3 Como funciona o fluxo Pix
```
Cliente diz "Quero pagar no Pix"
        │
        ▼
ChatPay chama POST /chatpay/charge → Gera QR Code (EMV) ou link Mercado Pago
        │
        ▼
Salva no Redis: pix:tx:{txid} = {status: "pending", amount, dom, rail}
        │
        ▼
Cliente paga → Confirmação via:
   • GET /confirm?key=MIDAS_SECRET&txid=...  (webhook interno)
   • POST /api/confirm {token, txid}        (JWT owner)
   • Poll GET /chatpay/status?txid=...      (página /pay)
        │
        ▼
status → "paid" → ChatPay avisa no chat: "Pagamento CONFIRMADO"
```

> ⚠️ **Não existe webhook `/chatpay/webhook-pix`** — a confirmação é via `/confirm` ou poll `/chatpay/status`.

---

## 🧠 3. IA e Base de Conhecimento (RAG / KB)

O Agente usa **RAG** (Retrieval-Augmented Generation): lê SUA base, não alucina.

### 3.1 Como é a página de KB no Dashboard
- Menu: **Base de Conhecimento (KB)**
- Editor de texto com **títulos obrigatórios** (`### Subseção`)
- Exemplo de estrutura:
```markdown
### 1. Garantia
Nossa garantia é de 7 dias. Risco zero para você.

### 2. Para quem é
Serve para infoprodutores, e-commerces, prestadores de serviço...

### 3. Objeção: "Tá caro"
Ancore por dia: R$ 3,23/dia. Venda perdida custa mais.
```

### 3.2 Variáveis Dinâmicas (substituídas automaticamente)
| Variável | Fonte | Exemplo de saída |
|----------|-------|------------------|
| `{{NOME_AGENTE}}` | `store.agente.nome` | `Mafel` |
| `{{NOME_LOJA}}` | `store.loja.nome` | `ChatPay` |
| `{{PRODUTO_PRINCIPAL}}` | `products[0].name` | `ChatPay Trial 30d` |
| `{{PRECO}}` | `products[0].cents` formatado | `R$ 97,00` |
| `{{PRECO_POR_DIA}}` | `cents / 30` | `R$ 3,23` |
| `{{GARANTIA_DIAS}}` | `products[0].garantia.dias` | `7` |
| `{{LINK_CHECKOUT}}` | `buildPayLink(dom, productId)` | `https://.../pay?d=...&p=...` |
| `{{NICHO}}` | `store.loja.nicho` | `Automatização com IA` |
| `{{FORMAS_PAGAMENTO}}` | `store.pagamento.metodos` | `Pix, Cartão até 12x` |
| `{{REGRAS_LOJISTA}}` | `store.regras_do_lojista[]` | `Nunca oferecer desconto sem autorização` |

> ✅ **Personalização por cliente:** Cada domínio tem seu `data/{dominio}.json` com regras, produtos, FAQ, tom de voz. As variáveis acima vêm **automaticamente** desse cadastro — você **não edita variáveis**, edita o cadastro da loja.

### 3.3 Como escrever sua KB (regras de ouro)
1. **Use `###` para cada tópico** — o sistema faz chunking por subtítulo
2. **Inclua a variável no texto** — ex: `Garantia de {{GARANTIA_DIAS}} dias`
3. **Seja específico** — exemplos reais, números reais, tom do seu cliente
4. **Cubra objeções** — "Tá caro", "Vou pensar", "Não confio", "Já tenho"
5. **Teste:** No Dashboard → **KB** → botão **Testar Pergunta**

### 3.4 O que acontece quando você salva
```
Seu texto Markdown
        │
        ▼
chunkText() → quebra por ### (com contexto do ## pai)
        │
        ▼
embedKb() → @cf/baai/bge-m3 (1024 dims) → Vectorize (kb-midas-core)
        │
        ▼
Espelho Redis: kb:{domain} (para fallback keyword)
        │
        ▼
Pronto para kbRetrieve() → top-4 score ≥ 0.35
```

---

## 🤖 4. Swarm de Agentes de IA: Pipeline Padrão + Customização

O ChatPay é um **Swarm (Enxame)** de agentes especializados.

### 4.1 Pipeline Padrão (Lead → Venda)
Quando chega uma mensagem (Telegram, Instagram, YouTube, TikTok, Web):

```
┌─────────────────────────────────────────────────────────────────┐
│                        EVENTO LEAD                              │
└──────────────────────────┬──────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. classifyIntentAdvanced                                     │
│     → Detecta: buy, objection, info_question, mild_interest    │
│     → Blacklist, Opt-out (LGPD), Toxicity, Custom keywords     │
│     → Modos: live_selling, dm_conversation, comment_to_buy...  │
└──────────────────────────┬──────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. objectionHandler (se intent = objection)                   │
│     → Memória de objeções anteriores (rememberMemory)          │
│     → priceOffer (bandit multi-armed) + issueCoupon            │
│     → Retorna {suggestion, coupon, payLink}                    │
└──────────────────────────┬──────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. craftReply (LLM + Tools + Honesty Judge)                   │
│     → Exemplos de sucesso (swarm:loop:approved)                │
│     → Playbook: nicho, tom, price_tier                         │
│     → RAG: kbRetrieve + fillKbVars (variáveis reais)           │
│     → Function calling: check_pix, faq_search, checkout_link   │
│     → Honesty Judge: bloqueia promessas falsas/escassez fake   │
│     → Guardian: rate limit por domínio                         │
└──────────────────────────┬──────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. proofGenerator                                             │
│     → realSales(24h) + realStock() → prova social real         │
└──────────────────────────┬──────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. timingOptimizer                                            │
│     → Analisa swarm:txlog → melhor horário de venda            │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Outros Agentes (eventos específicos)
| Evento | Agentes Disparados |
|--------|-------------------|
| **Pagamento confirmado** (`paid`) | `upsellArchitect` + `upsellAfterPaid` |
| **Carrinho abandonado** (`abandon`) | `scheduleRecovery` (3 etapas: 10min, 1h, 24h) |
| **WhatsApp com menção a concorrente** | `competitorAnalyzer` → pipeline completo |
| **Upsell manual** | `sendUpsell` |

### 4.3 O Padrão Ouro (Plug & Play)
> **Não quer customizar? Não precisa.** O ChatPay vem com o **Pipeline Padrão de Alta Conversão** — a mesma configuração que tem o maior histórico de vendas. É **plug and play**.

### 4.4 Customização Avançada (Dashboard → Swarm & Pipeline)
- Ative/desative agentes por canal (ex: `proofGenerator` só no Instagram)
- Mude a ordem do pipeline
- Crie agentes customizados (para usuários avançados)
- Configure `price_tier`: `low` (R$ 97), `medium` (R$ 500), `high` (R$ 2.000)

---

## 📲 5. Integrando Canais Sociais (100% API Oficial)

### 🟣 Instagram (DMs + Comentários Reels/Posts)

#### 5.1 Pré-requisitos no Meta for Developers
1. Acesse [developers.facebook.com](https://developers.facebook.com) → **Meus Apps** → **Criar App** → **Negócios**
2. Nome: `ChatPay Instagram SeuCanal`
3. Adicione produto: **Instagram Graph API**
4. **Configuração Básica** → copie **App ID** e **App Secret**
5. **Instagram Graph API** → **Configurações** → **Webhooks** → **Adicionar Callback URL**:
   ```
   https://midas-core.novoronaldo-m.workers.dev/webhook/instagram
   ```
   - **Verify Token:** `SEU_TOKEN_VERIFICACAO` (anote, vai no Dashboard)
   - **Campos:** `messages`, `messaging_postbacks`, `comment`, `story_insights`
6. **Tokens de Acesso:**
   - Gere **Page Access Token** (long-lived, 60 dias) para sua Página/Instagram Business
   - Permissões: `instagram_basic`, `instagram_manage_messages`, `instagram_manage_comments`, `pages_show_list`

#### 5.2 No Dashboard ChatPay
1. Menu: **Canais de Vendas** → **Redes Sociais** → **Instagram**
2. Preencha:
   - **Page ID / Access Token:** seu token long-lived
   - **Verify Token:** o mesmo do passo 5.1.4
   - **Domínio da Loja:** selecione
   - **Status:** Ativo ✅
3. **Salvar e Testar Conexão** → ✅ Verde = pronto

---

### 🔴 YouTube (Comentários + Live Chat)

> **Guia detalhado:** `docs/GUIA-YOUTUBE-SETUP.md` (passo a passo completo com OAuth, Pub/Sub, troubleshooting)

#### Resumo rápido:
1. **Google Cloud Console** → Projeto → **YouTube Data API v3** → Ativar
2. **Credenciais OAuth 2.0** → App Web → Redirect URI:
   ```
   https://midas-core.novoronaldo-m.workers.dev/api/oauth/youtube/callback
   ```
3. **Tela de consentimento OAuth** → Externo → Escopos: `youtube.force-ssl`, `youtube.readonly` → Seu email em usuários de teste
4. **Pub/Sub** → Inscrição → Tópico `youtube-webhook` → Push URL:
   ```
   https://midas-core.novoronaldo-m.workers.dev/webhook/youtube
   ```
   - Eventos: `comment` + `liveChat`
5. **Dashboard ChatPay** → **YouTube** → Cole: **Canal ID** (`UC...`), **Client ID**, **Client Secret**
6. **Testar Conexão** → Comente em live/vídeo → Resposta em <5s

---

### ⚫ TikTok (Comentários + DMs)

#### 5.1 Pré-requisitos no TikTok for Developers
1. Acesse [developers.tiktok.com](https://developers.tiktok.com) → **Criar App**
2. Produto: **Login Kit** + **Webhooks**
3. **App Credentials:** copie `client_key` e `client_secret`
4. **Webhook URL:**
   ```
   https://midas-core.novoronaldo-m.workers.dev/webhook/tiktok
   ```
5. **Eventos assinados:** `comment_create`, `message_create`

#### 5.2 No Dashboard ChatPay
1. Menu: **Canais de Vendas** → **TikTok**
2. Preencha: `client_key`, `client_secret`, Domínio, Status Ativo
3. **Salvar e Testar**

---

## 🧪 6. Como Testar e Validar Tudo

### 6.1 Checklist pós-setup
- [ ] Loja cadastrada com domínio, nome, nicho
- [ ] Produto principal com preço, benefícios, garantia
- [ ] Gateway de pagamento configurado (teste: gere um Pix no `/pay`)
- [ ] KB escrita com `###` e variáveis `{{VAR}}` → **Testar Pergunta** no Dashboard
- [ ] Instagram: Token + Verify Token → Teste Conexão ✅
- [ ] YouTube: Canal ID + OAuth + Pub/Sub → Comentário teste → Resposta ✅
- [ ] TikTok: client_key/secret → Teste Conexão ✅

### 6.2 Simule um "Cliente Chato" (roteiro de validação)
| Canal | Mensagem | Esperado |
|-------|----------|----------|
| **Telegram** | `/start seu.dominio` | Menu 4 botões |
| **Telegram** | `"Tá caro"` | Objeção tratada + cupom/âncora + link |
| **Telegram** | `"Qual a garantia?"` | Resposta KB (sem link) |
| **Telegram** | `"Quero comprar"` | Link checkout com `&p=` |
| **Instagram DM** | `"Preço?"` | Resposta + link |
| **YouTube comentário** | `"Serve pra iniciante?"` | Resposta KB + link se intenção compra |
| **TikTok comentário** | `"Como pago?"` | Pix + cartão 12x + link |

### 6.3 Verifique no Dashboard
- **Leads** → `hunter:leads:{dom}`: aparecem contatos com `platform: instagram/youtube/tiktok/telegram/web`
- **Analytics** → Conversão, intenções top, receita atribuída
- **Logs** → Filtre por canal para ver erros

---

## 🔒 7. Privacidade, LGPD e Conformidade

| Aspecto | Como o ChatPay trata |
|---------|---------------------|
| **Dados coletados** | Texto da mensagem, ID público do usuário, platform, timestamp |
| **Não coletados** | Email, telefone, CPF, dados sensíveis (ficam no checkout seguro) |
| **Retenção** | Leads: 30 dias no Redis (`hunter:leads:{dom}`) → auto-expira |
| **Opt-out (LGPD)** | Cliente diz "não quero mais" → blacklist 90 dias + analytics |
| **Export/Delete** | Dashboard → **LGPD** → Exportar/Apagar leads do domínio |
| **YouTube/Instagram Terms** | API oficial, dentro dos termos de cada plataforma |

---

## 📊 8. Métricas e Acompanhamento (Dashboard → Analytics)

| Métrica | O que mostra | Como melhorar |
|---------|--------------|---------------|
| **Leads/dia** | Volume por canal | Ative mais canais, melhore CTAs |
| **Conversão** | `vendas / leads` | Ajuste KB, revise objeções, melhore offer |
| **Intenções Top** | `buy` vs `objection` vs `info` | Se muito `objection` → revise preço/KB |
| **Receita atribuída** | Vendas vindas do ChatPay | Upsell, recovery, proofGenerator |
| **Tempo de resposta** | p50/p95 latency | Fast-paths já são <1s; LLM <8s |

---

## 🛠️ 9. Problemas Comuns (Troubleshooting Unificado)

| Sintoma | Canal | Causa | Solução |
|---------|-------|-------|---------|
| "Teste conexão falha" | Instagram | Token expirado / Verify Token errado | Regenere token long-lived; confira Verify Token idêntico |
| "Teste conexão falha" | YouTube | OAuth não autorizado / Pub/Sub inativo | Adicione seu email em usuários de teste; re-crie inscrição |
| Comentário sem resposta | YouTube/TikTok | Inscrição Pub/Sub não ativa | Cloud Console → Inscrições → Status "Ativa" |
| Resposta genérica / sem KB | Todos | KB vazia / variáveis não preenchidas | Escreva KB com `###`; cadastre produtos/garantia na loja |
| Link de checkout errado | Todos | Domínio errado no cadastro do canal | Confira se domínio do canal = domínio da loja |
| Pix não confirma | Todos | `/confirm` não chamado / webhook gateway | Verifique logs; use poll `/chatpay/status` |
| "Não tenho essa informação" | Todos | `playbook_fallback` acionado | Adicione FAQ na KB ou no `data/{dom}.json` |

---

## 📞 10. Suporte e Próximos Passos

### Onde encontrar ajuda
| Recurso | Link / Comando |
|---------|----------------|
| **Suporte Telegram** | `@ChatPaySuporte_bot` ou `/humano` no bot do cliente |
| **Guia YouTube detalhado** | `docs/GUIA-YOUTUBE-SETUP.md` |
| **Documentação técnica** | `docs/HANDOFF-REVISOR.md` (para devs) |
| **Logs de erro** | Dashboard → **Logs** → filtre por canal |
| **Teste KB** | Dashboard → **Base de Conhecimento** → **Testar Pergunta** |

### Próximos passos recomendados
1. **Semana 1:** Configure loja + Pix + KB básica + 1 canal (comece pelo Telegram)
2. **Semana 2:** Ative Instagram + YouTube → teste ao vivo com comentários reais
3. **Semana 3:** Analise `Analytics` → ajuste KB nas intenções `objection` e `info_question`
4. **Semana 4:** Ative TikTok + configure `upsellArchitect` + `scheduleRecovery`
5. **Contínuo:** A cada 100 leads, revise `Analytics` → melhore KB → itere

---

## 📚 11. Onde Encontram-se os Documentos (para sua referência)

| Documento | Localização | Para que serve |
|-----------|-------------|----------------|
| **Guia YouTube (detalhado)** | `docs/GUIA-YOUTUBE-SETUP.md` | OAuth, Pub/Sub, troubleshooting YouTube |
| **Guia WhatsApp CoEx** | `docs/GUIA-WHATSAPP-COEX.md` | Bot + humano no mesmo número: painel, Meta, checklist |
| **Guia Cliente Completo (este)** | `docs/GUIA-CLIENTE-SETUP-COMPLETO.md` | Setup completo: loja, Pix, KB, Agentes, Canais |
| **Guia Testes/QA** | `docs/qa/GUIA-TESTES.md` | 12 personas, smokes, regressão |
| **Dados da Loja (formato)** | `data/chatpay.oficial.json` | Exemplo de cadastro completo |
| **KB Mestre (MAFEL)** | `docs/kb/MAFEL-KB.md` | 16 seções de respostas por intenção + QA |
| **Pagamento Pix** | `docs/pix-payment.md` | Fluxo técnico `/charge`, `/confirm`, `/status` |
| **Blindagem Playbook** | `docs/playbook-fallback.md` | Fluxo out-of-playbook → KB → menu |
| **Roadmap Futuro** | `docs/roadmap/ROADMAP.md` | Voice AI, APIs chinesas, Spatial (fases 2–5) |
| **Deploy & Rollback** | `docs/deploy-runbook.md` | Procedimento de deploy, manutenção Vectorize |
| **Evidências FASE I4** | `docs/FASE-I4-EVIDENCIA.md` | Gates reais vs mock, qualidade replies |
| **Refatoração FSM Grupo** | `docs/FSM-USUARIO-GROUP-REFATORACAO.md` | Schema por usuário em grupo |

> 💡 **Dica:** Todos esses arquivos estão no repositório do projeto. Para acesso direto, peça à equipe técnica o link do repositório ou acesse via Dashboard → **Documentação**.

---

## 🔄 12. Atualização Autônoma da Base de Conhecimento (Ideia Futura)

> **Conceito:** Se comprovado por um agente que as vendas melhoram com cada cliente, a KB poderia ser atualizada automaticamente.

### Como funcionaria (proposta)
```
1. Agente Analyzer (novo) roda semanalmente:
   - Analisa swarm:txlog + hunter:leads + analytics
   - Identifica: objeções novas, FAQs frequentes, gaps na KB
   
2. Gera sugestões de chunks para KB:
   - "Cliente perguntou X 15x esta semana → adicione seção ### X"
   - "Objeção Y converteu com resposta Z → atualize seção ### Y"
   
3. Humano aprova (ou auto-aprova se confiança > 90%)
   
4. Atualiza KB → re-upload Vectorize → nova versão deploy
   
5. Histórico versionado: kb:{dom}:v1, v2, v3... (auditoria)
```

### Requisitos para implementar
- [ ] Agente `kbAnalyzer` no pipeline (pós-venda / weekly cron)
- [ ] Métrica de "lift de conversão por chunk de KB"
- [ ] Aprovação humana no Dashboard (cards de sugestão)
- [ ] Versionamento de KB no Redis + Vectorize (não sobrescrever cego)
- [ ] Rollback automático se conversão cair >5% após update

> **Status atual:** Ideia documentada. Não implementado. Requer validação de ROI com dados reais de múltiplos clientes.

---

## ✅ Checklist Final Geral (marque tudo antes de ir ao ar)

### Loja e Produto
- [ ] Domínio definido e cadastrado
- [ ] Nome, nicho, slogan preenchidos
- [ ] Produto principal: nome, descrição, preço (centavos), benefícios
- [ ] Garantia: dias + texto
- [ ] Regras do lojista + proibições cadastradas

### Pagamento
- [ ] Gateway escolhido (Pagar.me / Mercado Pago / Stripe)
- [ ] Credenciais coladas no Dashboard
- [ ] Teste: acesse `/pay?d=SEU_DOMINIO` → gere Pix → pague (pode ser valor mínimo) → confirme

### IA / KB
- [ ] KB escrita com estrutura `### Subseção`
- [ ] Variáveis `{{VAR}}` usadas no texto
- [ ] Cobertura: Garantia, Preço, Nicho, Objeções (caro, pensar, confiança, concorrente)
- [ ] Botão "Testar Pergunta" → respostas corretas, variáveis preenchidas, sem `{{}}` residual

### Canais Sociais
- [ ] **Instagram:** App Meta criado, Webhook configurado, Token long-lived, Verify Token, Teste ✅
- [ ] **YouTube:** GCP projeto, API v3, OAuth, Pub/Sub inscrição ativa, Teste ✅
- [ ] **TikTok:** App criado, Webhook, client_key/secret, Teste ✅

### Validação Final
- [ ] Cliente chato testado em **todos os canais ativos**
- [ ] Leads aparecendo no Dashboard → Analytics
- [ ] Conversão inicial medida (benchmark)
- [ ] Equipe sabe usar `/humano` e `/retomar` no Telegram

---

> **Última atualização:** 2026-09-25  
> **Versão do worker:** `29b1d54f` (Canais Sociais operacionais)  
> **Dúvidas?** `@ChatPaySuporte_bot` no Telegram ou abra issue no repositório