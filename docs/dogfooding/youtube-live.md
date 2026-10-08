# YouTube Live - ChatPay Dogfooding

## Roteiro da 1ª Live (45 minutos)

### 1. Abertura e Introdução (5 minutos)
- **Apresentador**: "Bem-vindos à primeira live oficial do ChatPay!"
- **Objetivo**: Apresentar o ChatPay e Hunter IA
- **Script**:
  - "Hoje vamos vender usando IA em tempo real"
  - "O Hunter ChatPay detecta intenção de compra nos comentários"
  - "Vocês vão ver ele responder automaticamente e gerar links de pagamento"
  - "Essa é a tecnologia que está mudando o e-commerce no Brasil"

### 2. Demonstração da Tecnologia (10 minutos)
- **Apresentador**: "Vou mostrar como funciona o Hunter"
- **Ação**: Mostrar dashboard `/dash` ao vivo
- **Demonstração**:
  - Explicar taxonomia de 1055+ variações de intenção
  - Mostrar os 5 modos operantes (LIVE_SELLING, DM, GROUP, COMMENT, QA)
  - Demonstrar modo LIVE_SELLING para YouTube
  - Mostrar batch mode (respostas em grupo)
- **Script**:
  - "O Hunter entende 1055+ variações de intenção de compra"
  - "Em lives, ele usa o modo LIVE_SELLING com alta sensibilidade"
  - "Ele responde em batch a cada 60 segundos para evitar spam"
  - "Vejam aqui no dashboard: está configurado para capturar 'eu', '1', 'quero', etc."

### 3. Live Teste Interativo (15 minutos)
- **Apresentador**: "Vocês podem testar agora!"
- **Call to Action**: "Escrevam 'quero comprar' nos comentários"
- **O que esperar**:
  - Hunter detecta sinais de compra nos comentários
  - Batch de 3+ usuários → resposta agregada
  - Link de pagamento Pix gerado automaticamente
  - Prova social em tempo real
- **Script**:
  - "Escrevam 'quero comprar' ou 'quanto custa' nos comentários"
  - "Vejam como o Hunter captura essas mensagens"
  - "Quando tiver 3+ pessoas interessadas, ele responde em bloco"
  - "Isso evita spam e cria urgência"

### 4. Análise de Métricas ao Vivo (10 minutos)
- **Apresentador**: "Vejam as métricas em tempo real"
- **Ação**: Acessar `/api/public-stats?d=chatpay.oficial`
- **Demonstração**:
  - Leads capturados na live
  - Vendas em tempo real
  - Taxa de conversão
  - GMV (Gross Merchandise Value)
- **Script**:
  - "Veja aqui: já capturamos X leads nesta live"
  - "Tivemos Y vendas automáticas de R$ ZZZ"
  - "A taxa de conversão está em W%"
  - "Isso é o poder do Hunter IA"

### 5. Oferta e Call to Action (5 minutos)
- **Apresentador**: "Querem usar o ChatPay no seu negócio?"
- **Oferta**: Trial 30 dias por R$ 97
- **Script**:
  - "Se você quer essa tecnologia no seu negócio"
  - "Trial de 30 dias por apenas R$ 97"
  - "Acesse o link na descrição da live"
  - "O ChatPay V22.2 está pronto para você usar"

## Checklist Técnico Pré-Live

### Configuração Hunter
- [ ] Hunter configurado no modo LIVE_SELLING
- [ ] Batch mode ativado (responde a 3+ usuários)
- [ ] Cooldown por usuário: 5 minutos
- [ ] Max respostas/hora: 5
- [ ] Taxonomia carregada (1055+ variações)
- [ ] Tokens de acesso Hunter válidos

### Configuração YouTube
- [ ] Extensão Hunter YouTube instalada
- [ ] Canal YouTube configurado
- [ ] Stream configurado para 1080p
- [ ] Chat habilitado na live
- [ ] Delay do chat: 5 segundos (evitar spam)
- [ ] Palavras-chave configuradas: "quero", "comprar", "preço", "valor"

### Infraestrutura
- [ ] Worker Cloudflare funcionando
- [ ] Dashboard acessível (`/dash`)
- [ ] Analytics funcionando (`/api/hunter-analytics-v2`)
- [ ] Public stats acessível (`/api/public-stats`)
- [ ] Link de vendas gerado e testado
- [ ] Pagamento Pix configurado

### Equipmento
- [ ] Microfone de qualidade
- [ ] Webcam HD
- [ ] Internet estável (upload 10+ Mbps)
- [ ] Software de streaming (OBS/Streamlabs)
- [ ] Segundo monitor para dashboard
- [ ] Iluminação adequada

### Conteúdo
- [ ] Thumbnail da live criada
- [ ] Título otimizado: "Vendendo com IA ao Vivo - ChatPay Hunter"
- [ ] Descrição com link de vendas
- [ ] Overlays configurados
- [ ] Screenshots do dashboard preparados
- [ ] Script de backup impresso

## Checklist Durante a Live

### 5 Minutos Antes
- [ ] Verificar conexão internet
- [ ] Testar microfone e câmera
- [ ] Abrir dashboard em segundo monitor
- [ ] Verificar analytics carregando
- [ ] Testar link de vendas
- [ ] Confirmar extensão Hunter ativa
- [ ] Verificar chat do YouTube

### Durante a Live
- [ ] Monitorar respostas do Hunter
- [ ] Ajustar threshold se necessário
- [ ] Ativar/desativar Hunter se precisar
- [ ] Compartilhar screen do dashboard
- [ ] Ler comentários relevantes
- [ ] Agradiar engajamento
- [ ] Monitorar métricas em tempo real

### 5 Minutos Depois
- [ ] Verificar vendas capturadas
- [ ] Exportar leads da live
- [ ] Analisar métricas completas
- [ ] Salvar screenshots de analytics
- [ ] Enviar email de follow-up para leads
- [ ] Agendar próxima live
- [ ] Agradiar público

## Overlay para Live

### Camada 1 - Prova Social
```
┌─────────────────────────────────┐
│  🎯 HUNTER IA AO VIVO           │
│  Leads: 23  |  Vendas: 5       │
│  Conversions: 21.7%             │
└─────────────────────────────────┘
```

### Camada 2 - Call to Action
```
┌─────────────────────────────────┐
│  🔗 LINK DE VENDAS              │
│  midas-core.workers.dev/pay    │
│  Trial 30d - R$ 97             │
└─────────────────────────────────┘
```

### Camada 3 - Status Hunter
```
┌─────────────────────────────────┐
│  🤖 HUNTER STATUS              │
│  Mode: LIVE_SELLING ✅         │
│  Batch: 3+ users 🚀            │
│  Responses: 3/5 hour          │
└─────────────────────────────────┘
```

## Troubleshooting

### Hunter não responde
1. Verificar se modo LIVE_SELLING está ativo
2. Checar threshold de confiança
3. Confirmar palavras-chave configuradas
4. Verificar rate limit (5/hora)
5. Checar logs no dashboard

### Erro de conexão
1. Verificar internet estável
2. Testar link do worker
3. Verificar token de acesso
4. Checar status do Cloudflare

### Comentários não aparecem
1. Verificar chat habilitado no YouTube
2. Checar delay do chat
3. Confirmar sem filtros ativos
4. Verificar modo de moderação

## Perguntas Frequentes da Live

**Q: O Hunter funciona em outras plataformas?**
A: Sim, funciona em YouTube, Instagram, TikTok, WhatsApp e Telegram.

**Q: Quantas lives posso fazer?**
A: Ilimitadas, o Hunter funciona 24/7 sem limite.

**Q: Posso personalizar as respostas?**
A: Sim, pelo dashboard você pode customizar templates e tom de voz.

**Q: Como recebo o pagamento?**
A: Direto na sua conta Pix via QR Code gerado automaticamente.

**Q: Existe suporte técnico?**
A: Sim, suporte via email e WhatsApp para clientes do trial.
