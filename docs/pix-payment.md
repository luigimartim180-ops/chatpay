# Pagamento Pix — como o worker cobra e confirma

Não há cadastro manual de Pix no `data/*.json` além da chave em Redis (`cfg:{dom}:pix` ou `swarm:pix`). A cobrança é gerada no endpoint.

## `POST /chatpay/charge` — L3264

Body real (não usa `chatId` / `produtoId` / `valor`):

```json
{ "amount": 97.00, "desc": "ChatPay Trial 30d", "dom": "chatpay.oficial",
  "token": "<JWT optional>", "demo": false, "ref": "", "lead_id": "" }
```

| Rail | Quando | txid | Resposta |
|------|--------|------|----------|
| Mercado Pago | `mpToken()` ok e `!demo` | `MP{id}` | `{ txid, payload: qr_code, amount, rail: "mercado_pago" }` |
| Pix estático | sem MP ou demo | `CP{ts}` ou `MIDAS{ts}` | `{ txid, payload: EMV, amount, rail: "pix_estatico" }` |

Redis: `SET pix:tx:{txid}` → `{ amount, status: "pending"|"demo", dom, …, rail }`  
Também grava `swarm:pix:last_tx` e (MP) linha em TiDB.

## Fluxo real da página `/pay`

1. `GET /pay?d=chatpay.oficial` → `payPage()` (L2305/2374)
2. Front chama `POST /chatpay/charge` com `{ amount, desc, dom, brand, ref, lead_id }` (L2325) — **sem** `chatId`/`produtoId`
3. Worker cria Pix (MP ou estático) e salva `pix:tx:{txid}` com `pending`
4. Cliente paga; confirmação **não** usa `/chatpay/webhook-pix` (endpoint **não existe**)

## Confirmação (caminhos reais)

| Endpoint | Auth | Efeito |
|----------|------|--------|
| `GET /confirm?key=MIDAS_SECRET&txid=` | secret | `status → paid`, métricas, email, webhook `payment_confirmed` |
| `POST /api/confirm` `{ token, txid }` | JWT dono | idem |
| `GET /chatpay/status?txid=` | público (poll) | MP: `mpStatus` approved → auto-`paid`; demo >15s → `paid` |

Não há webhook de gateway Efí/genérico em `/chatpay/webhook-pix`.

## Consulta no Telegram

`lookupTelegramPayment(domain, text, chatId)` — **L761**

1. txid no texto: `\b(CP\d{6,}|MP\d+)\b` ou link `?tx=`
2. senão sessão `tg:tx:{chatId}`
3. **não** usa `swarm:pix:last_tx` (sem fallback inventado)
4. `GET pix:tx:{txid}` → `paid` / `pending` / `not_found` / `wrong_domain`

Resposta fixa: `telegramPaymentReply` (L792)  
Filtro anti-alucinação: `enforceTelegramPaymentTruth` (L807) — só confirma `paid` com prova Redis.

## UX-FAST Checkout Flow

1. `GET /pay?d=chatpay.oficial` → Email input form presented before QR Code generation.
2. Front calls `POST /chatpay/charge` with `{ amount, desc, dom, buyer_email, brand, ref, lead_id }`.
3. Auto-polling triggers via `GET /chatpay/status?txid=...` every 3 seconds:
   - Status `pending`: Displays countdown timer (3 minutes).
   - Status `paid`: Screen updates immediately to success page without page refresh.
   - Status `expired`: Displays option to generate a new QR Code.
4. Confirmation via `GET /confirm?key=MIDAS_SECRET&txid=`:
   - Updates status to `paid`.
   - Sends transactional email via Resend API using sender `ChatPay <onboarding@resend.dev>`.

## Resumo vs doc antiga

| Doc antiga | Real |
|------------|------|
| body `{ chatId, produtoId, valor }` | `{ amount, desc, dom, buyer_email, token, … }` |
| retorna `qr_code`, `pix_link` | `payload` (EMV/QR), sem `pix_link` |
| webhook `/chatpay/webhook-pix` | **não existe** → `/confirm`, `/api/confirm`, poll `/chatpay/status` |
| gateway “Efí, etc.” | Mercado Pago **ou** Pix estático (`buildPix`) |
| `lookupTelegramPayment(txid)` | `(domain, text, chatId)` |
