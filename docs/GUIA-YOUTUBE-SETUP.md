# 🚀 Setup ChatPay no YouTube — Guia Completo para Clientes

> **Para quem é este guia:** Qualquer pessoa que queira conectar o ChatPay ao seu canal do YouTube para capturar leads de comentários e live chat, responder automaticamente com IA e converter vendas. **Não precisa ser programador.**

---

## 📋 O que você vai precisar ANTES de começar

| Item | Obrigatório? | Onde conseguir |
|------|--------------|----------------|
| Conta Google (mesma do canal YouTube) | ✅ Sim | [accounts.google.com](https://accounts.google.com) |
| Acesso ao **Google Cloud Console** | ✅ Sim | [console.cloud.google.com](https://console.cloud.google.com) |
| **YouTube Data API v3** ativada | ✅ Sim | No Google Cloud Console (passo a passo abaixo) |
| **Canal do YouTube** vinculado à conta | ✅ Sim | Seu canal existente |
| **Acesso ao Dashboard ChatPay** | ✅ Sim | Fornecido pela equipe ChatPay |
| Domínio da loja configurado no ChatPay | ✅ Sim | Ex: `sualoja.chatpay.oficial` (criado no onboarding) |

> ⏱️ **Tempo estimado:** 15–30 minutos na primeira vez. Depois é só usar.

---

## 🎯 1. Descubra o ID do SEU Canal

O ChatPay precisa do **ID do canal** (não o nome, não o @handle).

### Como encontrar:
1. Abra o YouTube logado na conta do canal
2. Clique no seu avatar → **Configurações** → **Configurações avançadas**
3. Procure **"ID do canal"** (formato: `UCxxxxxxxxxxxxxxxxxxxxxx`)
4. **Copie e guarde** — você vai colar no Dashboard

> 💡 **Dica:** Também funciona acessando `https://www.youtube.com/account_advanced` direto.

---

## 🔐 2. Prepare o Google Cloud Console (uma única vez)

### 2.1 Crie ou selecione um projeto
1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. No topo, clique no seletor de projeto → **Novo projeto**
3. Nome sugerido: `ChatPay-YouTube-SeuCanal` → **Criar**
4. Aguarde a criação e **selecione o projeto** no seletor

### 2.2 Ative a YouTube Data API v3
1. No menu lateral: **APIs e serviços** → **Biblioteca**
2. Busque **"YouTube Data API v3"**
3. Clique nela → **Ativar**

### 2.3 Crie credenciais OAuth 2.0 (para o webhook receber notificações)
1. **APIs e serviços** → **Credenciais**
2. **+ Criar credenciais** → **ID do cliente OAuth**
3. Tipo: **Aplicativo da Web**
4. Nome: `ChatPay YouTube Webhook`
5. **URIs de redirecionamento autorizados:** adicione:
   ```
   https://midas-core.novoronaldo-m.workers.dev/api/oauth/youtube/callback
   ```
6. **Salve** → Copie **Client ID** e **Client Secret** (guarde com segurança)

> 🔒 **Segurança:** Essas chaves dão acesso ao seu canal. Não compartilhe publicamente.

### 2.4 Configure a tela de consentimento OAuth
1. **APIs e serviços** → **Tela de consentimento OAuth**
2. Tipo: **Externo** → **Criar**
3. Nome do app: `ChatPay Integração YouTube`
4. Email de suporte: seu email
5. **Escopos:** adicione `.../auth/youtube.force-ssl` e `.../auth/youtube.readonly`
6. Usuários de teste: adicione seu email Google
7. **Salvar e continuar** até finalizar

---

## 🔗 3. Crie a Inscrição do Webhook (Pub/Sub)

É isso que faz o YouTube **avisar o ChatPay** quando alguém comenta.

### 3.1 No Google Cloud Console
1. **APIs e serviços** → **YouTube Data API v3** → **Gerenciar**
2. Aba **Inscrições do Pub/Sub** → **Criar inscrição**
3. Preencha:
   - **Tópico:** `projects/seu-projeto-id/topics/youtube-webhook` (será criado automaticamente)
   - **URL de push:** `https://midas-core.novoronaldo-m.workers.dev/webhook/youtube`
   - **Tipo de evento:** marque **`comment`** e **`liveChat`**
4. **Criar**

> ⚠️ **Importante:** O tópico Pub/Sub deve estar no **mesmo projeto** onde você criou as credenciais OAuth.

### 3.2 Verifique se a inscrição está ativa
- Na lista de inscrições, o status deve ficar **"Ativa"**
- Se der erro, verifique se a URL do webhook responde `200 OK` (o ChatPay já responde ao challenge automaticamente)

---

## 🖥️ 4. Configure no Dashboard do ChatPay

### 4.1 Acesse o Dashboard
- URL: `https://midas-core.novoronaldo-m.workers.dev/dash`
- Use a senha administrativa fornecida no onboarding

### 4.2 Cadastre o canal YouTube
1. Menu lateral: **Canais de Vendas** → **Redes Sociais**
2. Clique em **+ Novo Canal** → Selecione **YouTube**
3. Preencha:
   | Campo | O que colocar |
   |-------|---------------|
   | **ID do Canal** | O `UC...` que você copiou no passo 1 |
   | **Client ID OAuth** | O Client ID do passo 2.3 |
   | **Client Secret OAuth** | O Client Secret do passo 2.3 |
   | **Domínio da Loja** | Selecione seu domínio (ex: `chatpay.oficial`) |
   | **Status** | **Ativo** ✅ |
4. Clique em **Salvar e Testar Conexão**

> ✅ **Teste de conexão:** O botão "Testar" faz uma chamada real à API do YouTube. Se aparecer ✅ **Conectado**, está tudo certo.

---

## 🧪 5. Teste Ao Vivo (o momento da verdade)

### 5.1 Prepare o cenário
1. No seu canal, abra uma **Live ao vivo** ou um **vídeo recente** com comentários abertos
2. Use outra conta (ou peça a alguém) para comentar como se fosse cliente

### 5.2 Comentários de teste sugeridos
| Comentário | O que deve acontecer |
|------------|---------------------|
| `"Qual o preço?"` | Resposta com valor + link de checkout |
| `"Quero comprar"` | Link direto de pagamento Pix/cartão |
| `"Tem garantia?"` | Resposta sobre garantia (sem link) |
| `"Serve para iniciantes?"` | Resposta da KB personalizada |

### 5.3 O que verificar
- [ ] Resposta aparece **como resposta ao comentário** (não como comentário novo)
- [ ] Resposta chega em **menos de 5 segundos**
- [ ] Texto é **humanizado** (não robótico)
- [ ] Links de checkout têm `&p=SEU_PRODUTO_ID`
- [ ] No Dashboard → **Leads**, aparece o contato com plataforma `youtube`

---

## 🛠️ 6. Problemas Comuns e Soluções

| Sintoma | Causa Provável | Solução |
|---------|----------------|---------|
| "Erro ao testar conexão" no Dashboard | Client ID/Secret errados ou OAuth não autorizado | Refaça o passo 2.3 e 2.4; certifique-se de que seu email está em "Usuários de teste" |
| Comentário não recebe resposta | Inscrição Pub/Sub inativa ou tópico errado | Verifique status no Cloud Console; re-crie a inscrição no passo 3 |
| Resposta demora >30s | Cold start do worker ou quota YouTube excedida | Aguarde; verifique quotas no Cloud Console → APIs → Cotas |
| "Webhook verification failed" | URL errada ou não responde challenge | Confirme URL exata: `https://midas-core.novoronaldo-m.workers.dev/webhook/youtube` |
| Leads não aparecem no Dashboard | Domínio da loja errado no cadastro do canal | Confira se o domínio selecionado bate com seu `data/{dominio}.json` |

---

## 📊 7. O que acontece nos bastidores (para você entender)

```
Cliente comenta no YouTube
        │
        ▼
YouTube envia POST para /webhook/youtube (Pub/Sub push)
        │
        ▼
ChatPay valida assinatura + extrai: texto, autor, videoId, canalId
        │
        ▼
classifyIntentAdvanced() → identifica intenção (preço, compra, dúvida, etc.)
        │
        ▼
craftReply() + RAG (sua Base de Conhecimento) → gera resposta humanizada
        │
        ▼
Resposta postada como **reply** no comentário original + Lead salvo no Redis
        │
        ▼
Swarm de IA: objectionHandler → proofGenerator → timingOptimizer → upsellArchitect
```

---

## 🔒 8. Privacidade e Conformidade

- **Dados coletados:** Texto do comentário, ID do autor (público), videoId, timestamp
- **Não coletamos:** Email, telefone, dados sensíveis do comentarista
- **LGPD:** O lead fica no Redis por 30 dias (`hunter:leads:{dom}`) → você pode exportar/apagar via Dashboard
- **YouTube Terms:** A integração usa API oficial, dentro dos termos do YouTube

---

## 📞 9. Precisa de Ajuda?

| Canal | Como usar |
|-------|-----------|
| **Suporte ChatPay** | No Telegram: `@ChatPaySuporte_bot` ou `/humano` no bot do cliente |
| **Documentação técnica** | `docs/HANDOFF-REVISOR.md` (para devs) |
| **Logs de erro** | No Dashboard → **Logs** → filtre por `youtube` |

---

## ✅ Checklist Final (marque antes de considerar pronto)

- [ ] Conta Google Cloud criada/projeto selecionado
- [ ] YouTube Data API v3 ativada
- [ ] Credenciais OAuth 2.0 criadas (Client ID + Secret)
- [ ] Tela de consentimento OAuth configurada (seu email em usuários de teste)
- [ ] Inscrição Pub/Sub criada e **Ativa** (eventos: comment + liveChat)
- [ ] Canal cadastrado no Dashboard ChatPay com IDs corretos
- [ ] Botão "Testar Conexão" → ✅ Verde
- [ ] Teste ao vivo: comentário → resposta em <5s
- [ ] Lead aparece no Dashboard → Leads

---

## 🎉 Próximos Passos

1. **Personalize a Base de Conhecimento** (`/dash` → **KB / RAG**) com suas FAQs, objeções, tom de voz
2. **Configure o Swarm de Agentes** (`/dash` → **Swarm & Pipeline**) se quiser customizar o funil
3. **Ative Instagram e TikTok** na mesma tela — mesmo fluxo, APIs diferentes
4. **Acompanhe métricas** no Dashboard → **Analytics**: leads/dia, conversão, intenções top

---

> **Última atualização:** 2026-09-25  
> **Versão do worker:** `29b1d54f` (Canais Sociais operacionais)  
> **Dúvidas?** Abra issue no repo ou chame no Telegram `@ChatPaySuporte_bot`