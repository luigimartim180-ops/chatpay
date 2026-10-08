# Métricas Diárias - ChatPay Dogfooding

## Tabela de Métricas Diária

| Data | Leads | Respostas Hunter | Vendas | Opt-outs | Receita (R$) | Taxa Conversão | Canal Top |
|------|-------|------------------|--------|-----------|---------------|----------------|------------|
| DD/MM | 0 | 0 | 0 | 0 | 0,00 | 0% | - |

### Como Preencher

#### 1. Leads
**Endpoint**: `/api/hunter-analytics-v2?d=chatpay.oficial&token=SEU_TOKEN`
**Campo**: `leads_total`
**Definição**: Total de usuários que interagiram com Hunter
**Como ler**: Número de leads capturados no dia

#### 2. Respostas Hunter
**Endpoint**: `/api/hunter-analytics-v2?d=chatpay.oficial&token=SEU_TOKEN`
**Campo**: Calculado a partir de `interactions_by_mode`
**Definição**: Quantas vezes o Hunter respondeu automaticamente
**Como ler**: Soma de interações por modo operante

#### 3. Vendas
**Endpoint**: `/api/hunter-analytics-v2?d=chatpay.oficial&token=SEU_TOKEN`
**Campo**: Calculado a partir de `revenue_attributed_cents`
**Definição**: Número de vendas confirmadas (Pix pago)
**Como ler**: Contagem de transações com status "paid"

#### 4. Opt-outs
**Endpoint**: `/api/hunter-analytics-v2?d=chatpay.oficial&token=SEU_TOKEN`
**Campo**: `optout_count`
**Definição**: Usuários que solicitaram não receber mais mensagens (LGPD)
**Como ler**: Número de opt-outs no dia

#### 5. Receita (R$)
**Endpoint**: `/api/hunter-analytics-v2?d=chatpay.oficial&token=SEU_TOKEN`
**Campo**: `revenue_attributed_cents`
**Definição**: Receita total atribuída ao Hunter em reais
**Como ler**: Converta cents para reais (divide por 100)

#### 6. Taxa Conversão
**Endpoint**: `/api/hunter-analytics-v2?d=chatpay.oficial&token=SEU_TOKEN`
**Campo**: `conversion_rate`
**Definição**: (Vendas / Leads) * 100
**Como ler**: Percentual de leads que viraram vendas

#### 7. Canal Top
**Endpoint**: `/api/hunter-analytics-v2?d=chatpay.oficial&token=SEU_TOKEN`
**Campo**: `by_platform` (maior valor)
**Definição**: Canal com mais leads/vendas
**Como ler**: WhatsApp, YouTube, Instagram, TikTok, ou Telegram

## Métricas Públicas (Prova Social)

### Endpoint Público
**URL**: `/api/public-stats?d=chatpay.oficial`
**Acesso**: Público (sem autenticação)
**Rate Limit**: 10 requisições/minuto por IP

### Campos Disponíveis
```json
{
  "domain": "chatpay.oficial",
  "leads_approx": "mais de 40",
  "sales_approx": "mais de 10",
  "gmv_approx": "mais de R$ 3.500",
  "active_mode": "live_selling",
  "updated_at": "2026-09-08T12:00:00Z"
}
```

### Como Usar para Prova Social
- **Leads aproximados**: "Mais de X pessoas interessadas"
- **Vendas aproximadas**: "Mais de Y vendas confirmadas"
- **GMV aproximado**: "Mais de R$ Z em vendas"
- **Modo ativo**: "Hunter respondendo em modo LIVE_SELLING"

## Métricas Internas (Oracle)

### Endpoint Oracle
**URL**: `/oracle?key=MIDAS_SECRET`
**Acesso**: Requer chave secreta
**Propósito**: Debug e monitoramento avançado

### Campos Disponíveis
```json
{
  "pago": {
    "count": 15,
    "rev_cents": 145000,
    "por_trilho": {
      "pix_estatico": 10,
      "mercado_pago": 5
    }
  },
  "vendas_total": 145,
  "leads": 234,
  "clientes_trial": 5,
  "roteiros_aprovados": 12,
  "angulos": {...},
  "fonte": "redis"
}
```

### Como Ler
- **pago.count**: Vendas pagas hoje
- **pago.rev_cents**: Receita em centavos
- **por_trilho**: Distribuição por método de pagamento
- **vendas_total**: Total histórico de vendas
- **leads**: Total histórico de leads
- **clientes_trial**: Clientes em trial ativos

## Métricas por Categoria de Intenção

### Endpoint Analytics V2
**URL**: `/api/hunter-analytics-v2?d=chatpay.oficial&token=SEU_TOKEN`
**Campo**: `intents_by_category`

### Categorias Disponíveis
- **direct_intent**: "quero comprar", "quanto custa", etc.
- **live_signals**: "eu", "1", emojis, etc.
- **indirect_intent**: "como funciona", "tem garantia", etc.
- **objections**: "tá caro", "vou pensar", etc.
- **regional_slang**: "bah", "massa", etc.
- **typos**: "kero", "qro", etc.
- **emojis**: 🙋, 🔥, 🚀, etc.
- **host_questions**: "quem quer?", "comenta 1", etc.

### Como Analisar
Identifique qual categoria gera mais conversões:
1. Acompanhe `intents_by_category` diariamente
2. Compare com taxas de conversão por categoria
3. Otimize taxonomia para categorias de baixa performance
4. Foque em categorias de alta performance

## Métricas por Modo Operante

### Modos Disponíveis
- **LIVE_SELLING**: Para lives/streaming (alta sensibilidade)
- **DM_CONVERSATION**: Para 1:1 (alta confiança requerida)
- **GROUP_CHAT**: Para grupos (anti-spam rigoroso)
- **COMMENT_TO_BUY**: Para comentários (prioriza DM)
- **QA_SESSION**: Para Q&A (responde dúvidas)

### Endpoint
**URL**: `/api/hunter-analytics-v2?d=chatpay.oficial&token=SEU_TOKEN`
**Campo**: `interactions_by_mode`

### Como Analisar
Identifique qual modo performa melhor:
1. Compare leads por modo
2. Compare conversão por modo
3. Ajuste thresholds por modo
4. Otimize para o modo mais rentável

## Taxas de Conversão por Semana

### Semana 1 (WhatsApp Foco)
**Meta**: 5 trials / R$ 485
**Canal**: WhatsApp Group
**Estratégia**: Convidar 20-30 pessoas, demo ao vivo
**KPI**: Leads ≥ 20, Conversão ≥ 25%

### Semana 2 (YouTube Live)
**Meta**: 10 trials / R$ 970
**Canal**: YouTube Live
**Estratégia**: Live semanal, batch mode ativo
**KPI**: Leads ≥ 50, Conversão ≥ 20%

### Semana 3 (Instagram)
**Meta**: 20 trials / R$ 1.940
**Canal**: Instagram DM
**Estratégia**: Stories, comentários em posts
**KPI**: Leads ≥ 100, Conversão ≥ 20%

### Semana 4 (Multi-canal)
**Meta**: 40 trials / R$ 3.880
**Canal**: Todos os canais
**Estratégia**: Integração completa
**KPI**: Leads ≥ 200, Conversão ≥ 20%

## Alertas Automáticos

### Configurar Alertas
Configure alertas quando métricas atingirem thresholds:

**Alerta de Baixa Conversão**
- **Trigger**: Conversão < 15% por 3 dias consecutivos
- **Ação**: Revisar taxonomia, ajustar thresholds
- **Notificação**: Email + Dashboard

**Alerta de Alto Opt-out**
- **Trigger**: Opt-out rate > 10% por dia
- **Ação**: Revisar cooldown, ajustar threshold
- **Notificação**: Email + Dashboard

**Alerta de Zero Vendas**
- **Trigger**: Zero vendas por 24h com leads > 10
- **Ação**: Verificar Pagamento Pix, revisar resposta Hunter
- **Notificação**: Email + Dashboard

## Exportação de Dados

### Exportar Leads
**Endpoint**: `/api/hunter-leads?d=chatpay.oficial&token=SEU_TOKEN&limit=500`
**Formato**: JSON
**Uso**: Importar para CRM, email marketing

### Exportar Vendas
**Endpoint**: `/api/me?token=SEU_TOKEN`
**Campo**: `sales`
**Formato**: JSON
**Uso**: Contabilidade, analytics

### Exportar Respostas Hunter
**Endpoint**: `/api/hunter-feed?d=chatpay.oficial&token=SEU_TOKEN&limit=100`
**Formato**: JSON
**Uso**: Análise de qualidade de resposta

## Análise de Tendências

### Semanal
Comparar métricas da semana atual com anterior:
- Crescimento de leads (%)
- Crescimento de receita (%)
- Variação na taxa de conversão
- Mudança no canal top

### Mensal
Comparar métricas do mês atual com anterior:
- MRR (Monthly Recurring Revenue)
- CAC (Customer Acquisition Cost)
- LTV (Lifetime Value)
- Churn rate

## Relatório Diário Automático

### Configurar Email Diário
O ChatPay envia automaticamente email digest diário para domínios configurados:
- **Horário**: Cron job (toda hora, executa analyst)
- **Conteúdo**: Leads, vendas, receita, conversão
- **Destinatário**: Email configurado no domínio

### Como Ativar
1. Configure email no domínio via `/start`
2. Analyst roda automaticamente via cron
3. Email enviado com digest diário
4. Desative se não quiser receber

## Dashboard Visual

### Acessar Dashboard
**URL**: `/dash?token=SEU_TOKEN`
**Cards Principais**:
- Leads totais
- Vendas hoje
- Receita atribuída
- Modo Hunter ativo
- Budget LLM usado

### Gráficos Disponíveis
- Leads por plataforma
- Vendas por hora
- Conversão por categoria
- Respostas Hunter por dia

## Conclusão

Use estas métricas para:
1. Otimizar performance do Hunter
2. Identificar canais mais rentáveis
3. Ajustar taxonomia de intenção
4. Calcular ROI do ChatPay
5. Tomar decisões baseadas em dados

**MRR alvo após 30 dias**: ~R$ 1.200
**Leads alvo após 30 dias**: ~200
**Conversão alvo**: 20%
