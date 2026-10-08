# WhatsApp Group - ChatPay Dogfooding

## Template de Convite do Grupo

**Título**: ChatPay - Vendas ao Vivo com IA 🚀

**Mensagem de Convite**:
```
🎯 Bem-vindo ao grupo oficial de testes do ChatPay!

Este é um grupo exclusivo para testar nossa IA de vendas ao vivo.
Você vai ver o Hunter responder automaticamente a intenções de compra
em tempo real, diretamente no chat.

O que você vai ver aqui:
✅ IA respondendo automaticamente a "quero comprar", "quanto custa", etc.
✅ Geração automática de links de pagamento Pix
✅ Prova social em tempo real
✅ Demonstração da tecnologia ChatPay

⚠️ Este é um ambiente de testes - as mensagens da IA são automáticas.

Participe, interaja e veja o futuro das vendas automáticas! 🚀
```

## Roteiro de Demo ao Vivo (15 minutos)

### 1. Abertura (2 minutos)
- **Apresentador**: "Olá pessoal! Bem-vindos ao ChatPay Dogfooding Group"
- **Objetivo**: Explicar o que vão ver
- **Script**:
  - "Hoje vou mostrar a IA Hunter do ChatPay em ação"
  - "O Hunter detecta intenção de compra e responde automaticamente"
  - "Vocês podem testar enviando mensagens como 'quero comprar' ou 'quanto custa'"
  - "A IA vai responder com o link de pagamento automaticamente"

### 2. Ativação do Hunter ao Vivo (3 minutos)
- **Apresentador**: "Vou ativar o Hunter agora"
- **Ação**: Acessar dashboard `/dash` → Modo Operante → Ativar Hunter
- **Demonstração**:
  - Mostrar dashboard com Hunter ativado
  - Explicar o modo: GROUP_CHAT
  - Mostrar configurações: max 3 respostas/hora, cooldown 2h por usuário
- **Script**:
  - "Vejam no dashboard: Hunter está ativo no modo GROUP_CHAT"
  - "Ele vai responder no máximo 3 vezes por hora para evitar spam"
  - "Cada usuário tem cooldown de 2 horas entre respostas"

### 3. Demonstração Interativa (5 minutos)
- **Apresentador**: "Vocês podem testar agora!"
- **Call to Action**: "Escrevam 'quero comprar' ou 'quanto custa' no chat"
- **O que esperar**:
  - Primeiros 3 usuários recebem resposta automática
  - Resposta inclui link de pagamento Pix
  - Após 3 respostas, Hunter entra em cooldown
- **Script**:
  - "Vocês podem testar agora mesmo! Escrevam 'quero comprar'"
  - "Vejam como a IA responde automaticamente com o link"
  - "Após 3 respostas, ele descansa por 1 hora para não spammar"

### 4. Prova Social (3 minutos)
- **Apresentador**: "Vejam as métricas em tempo real"
- **Ação**: Acessar `/api/hunter-analytics-v2`
- **Demonstração**:
  - Mostrar leads capturados
  - Mostrar respostas do Hunter
  - Mostrar taxa de conversão estimada
- **Script**:
  - "Veja aqui nas analytics: já capturamos X leads"
  - "O Hunter respondeu Y vezes automaticamente"
  - "Temos Z taxa de conversão estimada"

### 5. Call to Action Final (2 minutos)
- **Apresentador**: "Querem usar o ChatPay no seu negócio?"
- **CTA**: Link de vendas
- **Script**:
  - "Se você quer usar essa tecnologia no seu negócio"
  - "Acesse o link no nosso site para trial de 30 dias"
  - "O ChatPay V22.2 está pronto para você"
  - "Obrigado por participar!"

## Checklist Pré-Demo

- [ ] Dashboard acessível em `/dash`
- [ ] Hunter configurado no modo GROUP_CHAT
- [ ] Produto "ChatPay Trial 30d" criado
- [ ] Link de vendas gerado
- [ ] Canais de pagamento Pix configurados
- [ ] Analytics funcionando (`/api/hunter-analytics-v2`)
- [ ] Grupo WhatsApp criado com 20-30 pessoas
- [ ] Convite enviado ao grupo
- [ ] Cronômetro de 15 minutos preparado
- [ ] Screenshots do dashboard prontos para compartilhar

## Perguntas Frequentes

**Q: A IA responde a todas as mensagens?**
A: Não, apenas a mensagens com intenção de compra detectada.

**Q: Quantas vezes o Hunter responde por hora?**
A: Máximo 3 vezes por hora para evitar spam.

**Q: Existe cooldown por usuário?**
A: Sim, 2 horas entre respostas para o mesmo usuário.

**Q: Posso desativar o Hunter?**
A: Sim, pelo dashboard no botão "Pausar Swarm".

**Q: As mensagens são reais ou de teste?**
A: Este é um ambiente de testes com dados reais.

## Métricas para Acompanhar

Use `/api/hunter-analytics-v2?d=chatpay.oficial&token=SEU_TOKEN` para acompanhar:
- **Leads totais**: Quantos usuários interagiram
- **Respostas Hunter**: Quantas vezes a IA respondeu
- **Taxa de conversão**: Leads que viraram vendas
- **Canais ativos**: WhatsApp, YouTube, Instagram, TikTok
