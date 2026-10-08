# Guia do Cliente — WhatsApp CoEx (bot + humano no mesmo número)

> **ITEM 6 do PLANO-MESTRE-CHATPAY-v2** · implementar este guia não exige trocar de número nem criar
> uma Chip ou app novo. O mesmo número do WhatsApp que já recebe as mensagens passa a atender
> automaticamente pela IA e, quando o cliente pedir, entrega a conversa para um atendente humano.

---

## 1. O que é CoEx (Coexistence)

O WhatsApp permite que **um atendente humano e um bot compartilhem o mesmo número**. Sem CoEx,
ou a IA responde, ou o humano responde — nunca os dois. Com CoEx ligado:

| Situação | Quem responde |
|---|---|
| Mensagem comum ("quero comprar") | **Bot (IA)** |
| Cliente pede humano ("falar com atendente") | **Atendente humano** — o bot cala |
| Cliente pede o bot de volta ("volta pro bot") | **Bot (IA)** retorna |
| Handoff expira sem resposta do cliente | **Bot (IA)** retoma sozinho |

O bot nunca interrompe um atendimento humano em andamento. Isso é o que evita a pior experiência
possível: o cliente pedir um humano e receber um robô falando por cima.

---

## 2. Ativação no painel (cliente)

1. Abra o painel `/dash` e faça login.
2. Entre em **🔌 Integrações V20** e preencha o bloco WhatsApp:
   - **Phone Number ID** — vem do Meta Business Manager → WhatsApp → API Setup.
   - **Access Token** — token permanente do System User com as permissões
     `whatsapp_business_messaging` e `whatsapp_business_management`.
   - **Template Name** — nome do template aprovado (ex.: `chatpay_payment`).
   - **Webhook Verify Token** — um segredo escolhido por você (ex.: `verify-token-local`).
   - **Preço padrão** — valor exibido no botão (ex.: `29,00`).
   - Clique em **Salvar WhatsApp**.
3. No mesmo painel, abra o card **🔀 WhatsApp CoEx (bot + humano)**:
   - Marque **Ativar CoEx neste número**.
   - **Gatilhos de handoff** — padrão `humano, atendente, pessoa de verdade, falar com alguem, nao e robo`.
   - **Gatilhos de retorno ao bot** — padrão `bot, robo, volta pro bot`.
   - **TTL do handoff** — por quantos segundos o bot fica calado depois do pedido
     (padrão `7200` = 2h; mínimo aceito `300` = 5min).
   - Clique em **Salvar CoEx**.

O card mostra ao vivo: mensagens recebidas hoje, handoffs, resolvidos, pendentes, taxa de
handoff, tempo médio de atendimento e a lista de conversas agora em atendimento humano, com
botão **devolver ao bot** para cada uma.

> **Segredos nunca são devolvidos em tela.** O painel indica apenas que a credencial existe
> (`wa_access_token_set: true`). Isso é intencional: se a API devolvesse o token, qualquer tela
> ou log vazaria a credencial da sua empresa.

---

## 3. Configuração no Meta (parte do técnico / agência)

O CoEx é habilitado no nível do **número de telefone (Phone Number)**, não do app. Passos:

1. **Meta Business Manager** → **WhatsApp Manager** → **Contas de telefone**.
2. Selecione o número que já recebe as mensagens.
3. **Ferramentas → WhatsApp CoEx** (ou *Coexistence*).
4. Defina **"Início da coexistência"** para os números dos atendentes humanos
   (normalmente o celular do time de vendas).
5. O Meta fornece um **código de verificação**. Faça o PIN de 6 dígitos no app WhatsApp do
   Business com o número principal e confirme o código.
6. Ainda no CoEx, defina a **mensagem de boas-vindas do atendente** (aparece na conversa
   quando um atendente entra).

Depois, no painel do ChatPay, a URL de webhook que você cadastra no Meta é:

```
https://midas-core.novoronaldo-m.workers.dev/webhook/whatsapp
```

e o **Verify Token** é o mesmo que você informou no painel.

> Importante: o CoEx **não** é ligado pelo ChatPay — o ChatPay apenas respeita o estado.
> Se o Meta ainda não habilitou CoEx no número, o bot continua funcionando sozinho; o
> cliente só não consegue chegar ao atendente pelo mesmo número.

---

## 4. Como o cliente percebe a diferença

Cliente: *"quero falar com uma pessoa de verdade"*

> Bot: "Chamei um atendente humano para te ajudar. Ele vai te atender aqui mesmo, neste número."

A partir daí, o bot **não responde mais** nesse número até o cliente pedir o bot de volta, o
atendente devolver manualmente pelo painel, ou o TTL expirar.

Cliente: *"volta pro bot"*

> Bot: "Voltei a ser o assistente automático. Me diz como posso ajudar."

O estado é **por contato**: se um cliente pede humano, apenas ele sai do atendimento
automático. Os outros continuam recebendo as respostas da IA normalmente.

---

## 5. Endpoints (referência técnica)

Todos exigem o token JWT do painel.

| Método | Rota | Função |
|---|---|---|
| `POST` | `/api/wa-coex/config` | Liga/desliga CoEx, ajusta gatilhos e TTL |
| `GET` | `/api/wa-coex/config` | Config CoEx atual (sem segredos) |
| `GET` | `/api/wa-coex/metrics` | Métricas do dia + 7 dias + resumo |
| `POST` | `/api/wa-coex/handoff` | Handoff manual ou `resume: true` para devolver ao bot |
| `GET` | `/api/wa-coex/active` | Conversas agora em atendimento humano |
| `POST` | `/webhook/whatsapp` | Entrada da Meta (já roteia CoEx) |

Exemplo de handoff manual (botão "atender" no seu CRM):

```bash
curl -X POST https://midas-core.novoronaldo-m.workers.dev/api/wa-coex/handoff \
  -H 'Content-Type: application/json' \
  -d '{"token":"SEU_JWT","from":"+5511999990000","reason":"dashboard"}'
```

Exemplo de devolução ao bot:

```bash
curl -X POST https://midas-core.novoronaldo-m.workers.dev/api/wa-coex/handoff \
  -H 'Content-Type: application/json' \
  -d '{"token":"SEU_JWT","from":"+5511999990000","resume":true}'
```

---

## 6. O que é medido

| Métrica | Onde | Para que serve |
|---|---|---|
| `inbound` | mensagens recebidas no dia | volume total do número |
| `handoffs` | transferências para humano | demanda real de atendimento |
| `resolved` | retornos ao bot / devoluções manuais | handoffs Closed |
| `pending` | `handoffs - resolved` | quantas conversas ficaram abertas |
| `bot_silent` | mensagens que o bot **não** respondeu | prova de que o bot respeitou o humano |
| `avg_resolution_ms` | tempo médio de atendimento | SLA do time |
| `status_delivered` / `status_failed` | callbacks da Meta | qualidade do número e do template |
| `handoff_rate_pct` | `handoffs / inbound` | dimensionar o time humano |

A chave Redis de métricas é `wa:coex:metrics:{dom}:{YYYY-MM-DD}` e o estado de atendimento é
`wa:coex:human:{dom}:{telefone}` com TTL.

---

## 7. Limites conhecidos

- **Depende do CoEx habilitado na Meta.** Sem isso, o handoff por gatilho funciona, mas o
  atendente humano precisa entrar manualmente no app.
- **Sem resposta do atendente, o bot só volta** quando o cliente pedir, quando alguém devolver
  pelo painel, ou quando o TTL expirar. Não há "timeout de silêncio" diferente do TTL.
- **Notificação ao dono** via Telegram usa o `TG_OWNER_CHAT` configurado no worker.
- **Áudio e mídia** (foto, documento, áudio) ainda não são transcritos no WhatsApp como são no
  Telegram; apenas texto e respostas de botão são tratados.
- **`/webhook/whatsapp` não valida assinatura `X-Hub-Signature-256`.** Isso já era verdade antes
  do CoEx e é uma recomendação de endurecimento: vincular o `wa:phone:{phone_id}` com a origem
  do request ou exigir o header de assinatura da Meta.

---

## 8. Checklist de validação com o cliente

1. Enviar *"quero comprar"* no número → o bot responde com o botão de pagamento.
2. Enviar *"falar com um atendente"* → o bot confirma e **para** de responder.
3. No painel, conferir que a conversa apareceu em **"Em atendimento humano"**.
4. Enviar mais 2 mensagens → **nenhuma** resposta do bot.
5. Clicar **devolver ao bot** no painel → o bot volta a responder.
6. Enviar *"volta pro bot"* → o bot responde e sai da lista de ativas.
7. Conferir o card de métricas com os números coerentes com o passo a passo.

---

Documentos relacionados: `AGENTS.md` (§1.16), `HANDOFF.md` (ITEM 6),
`docs/PLANO-MESTRE-CHATPAY-v2.md`, `docs/GUIA-CLIENTE-SETUP-COMPLETO.md`.
