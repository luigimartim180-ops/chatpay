# Blindagem — pergunta fora do playbook → menu (sem LLM)

Objetivo: se a fala não casa com o FAQ/playbook, **não** chamar o LLM; responder com mensagem + botões inline.

A diretiva antiga citava `env.KV`, `fs.read`, `sendTelegramWithButtons` e linhas ~L422/L2200 — **não existem**. Implementação real abaixo.

## Fluxo no handler (`/api/telegram-webhook`)

Ordem real (após `cleanTelegramReply`, sem depender disso):

```
fastTelegramPriceReply → fastTelegramProductReply → fastTelegramGuaranteeReply
  → hit?  intent price/guarantee/product_info (sem LLM)
  → miss? detectaPerguntaForaDoPlaybook(text, domain)
      → true?  kbRetrieve(domain, text, env) com hit?
                 → sim?  reply = chunk da KB → intent kb_rag_reply (sem LLM)
                 → não?  getFallbackConfig → intent playbook_fallback + replyButtons  (sem LLM)
      → false? systemNote (+ BASE DE CONHECIMENTO da KB) + callLlmTgTurn (contrato/loop de tools)
                → tool call? executeTgTool → devolve resultado → 2ª rodada → JSON final
                → falhou? getFallbackConfig → intent llm_fallback_menu
```

- Fora do playbook + override KB: bloco `outOfPlaybook` no handler (~L3137)
- Contrato LLM falhou: mesmo menu (`llm_fallback_menu`)
- Botões vão em `replyButtons` → `sendTelegramLimited(..., replyButtons)` (não há função `sendTelegramWithButtons`)
- **Gate de link** antes de enviar: `applyLinkPolicy(reply, intent, text)` — garantia/menu/produto/geral **sem** pay-link; compra/preço/pagamento/pedido explícito **com** (`buildPayLink` + `&p={productId}`)

## Helpers

| Função | Linha | Papel |
|--------|-------|--------|
| `getFallbackConfig(domain)` | 346 | lê `loadStoreData` → `fallback.quando_cliente_pergunta_fora_do_playbook`; senão `TG_FALLBACK_DEFAULT` |
| `tokenizePlaybookWords` | 353 | tokens ≥4 chars, sem acento |
| `jaccardSimilarity` | 357 | `\|A∩B\| / \|A∪B\|` |
| `detectaPerguntaForaDoPlaybook` | 367 | junta `data.faq[].pergunta` + `playbook.faq` keys; **true** se nenhuma pergunta ≥ 0.6 (Jaccard ou cobertura de tokens) |
| `sendTelegramLimited` | 505 | se `buttons[]`, monta `reply_markup.inline_keyboard` (`texto`/`callback`) |

Não usa Levenshtein; usa **Jaccard ≥ 0.6** + fallback de cobertura de tokens.

## Cadastro (`data/chatpay.oficial.json`)

```json
"fallback": {
  "quando_cliente_pergunta_fora_do_playbook": {
    "mensagem": "…",
    "botoes": [
      { "texto": "Quero comprar", "callback": "comprar" },
      { "texto": "Preço", "callback": "preco" },
      { "texto": "Garantia", "callback": "garantia" },
      { "texto": "Falar com humano", "callback": "humano" }
    ]
  }
}
```

4 botões = `TG_MENU_BUTTONS` (testes de fase 2 batem nisso).

## `callback_query` (L2461)

| `data` | Intent | Efeito |
|--------|--------|--------|
| `comprar` | `callback_buy` | link de pagamento + FSM `intencao_compra` |
| `menu` | `callback_menu` | menu 4 botões |
| `preco` | `callback_price` | `fastTelegramPriceReply` / product (**com** link `&p=`) |
| `garantia` | `callback_guarantee` | `fastTelegramGuaranteeReply` **sem link** (linkPolicy) |
| `humano` | `callback_handoff` | handoff TTL 7200 + **WhatsApp `wa.me/5511932270717`** + **Telegram `t.me/Tokenizeassets`** (botões URL) |
| outro | `callback_unknown` | "Opção inválida." |

`answerTelegramCallback` roda **antes** de enviar a resposta (ack imediato; sem spinner travado).  
Botões com `url` viram `inline_keyboard` tipo URL; com `callback` viram `callback_data` (`buildTelegramInlineKeyboard`).  
Mesmos links em `/humano`, texto "humano" e `handoff_irritado`.  
Contato: WhatsApp `wa.me/5511932270717` · Telegram `t.me/Tokenizeassets` (`TG_HUMAN_WHATSAPP` / `TG_HUMAN_TELEGRAM`).

### Se botões “não fazem nada” no Telegram

1. Webhook pode estar sem `allowed_updates: callback_query` → `POST /api/telegram/repair-webhook` com `{ "token": "<JWT owner>" }` (ou `?key=MIDAS_SECRET`).
2. Configure o mesmo segredo aleatório do webhook em mensagens e callbacks. `tg__shared` era determinístico e está comprometido; nunca use esse valor. Após deploy, execute `/api/telegram/repair-webhook` com autorização administrativa para rotacionar o segredo no Telegram e no Redis.
3. Probe esperado: callback `humano` → `intent=callback_handoff` + `wa.me` + `t.me` + `telegram_status=sent`.

## Testes e smoke

- `test/test-phase1.js` T7: fora do FAQ → `playbook_fallback` + botões sem LLM; FAQ ≠ fallback; callback preco; callback humano + handoff — **31/31**
- `test/test-phase2.js` P4/P12 — **22/22**
- `test/test-phase3-kb.js` — **20/20** (KB override `kb_rag_reply`, gate de link, tool loop, voz, chunking seção-first, `fillKbVars`)
- Smoke ao vivo persona 4/12 + smoke fase 3 (10/10) — PASS (ver [`GUIA-TESTES.md`](qa/GUIA-TESTES.md))

## Ver também

- Cadastro/loader: [`docs/store-data.md`](store-data.md)
- Pagamento: [`docs/pix-payment.md`](pix-payment.md)
