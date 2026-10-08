# Cadastro da loja — como o worker consome `data/{domain}.json`

Arquivo de cadastro: `data/chatpay.oficial.json`  
Espelho no worker: `EMBEDDED_STORES` (`worker.js` ~L199) — Workers não têm `fs` no runtime.

## Loader

```
loadStoreData(domain)  // worker.js L338
  1. Redis GET loja:{domain}
  2. fallback EMBEDDED_STORES[domain] || null
```

Não usa `env.KV` nem `fs.read`.

## `getFallbackConfig(domain)` — L346

 Lê `data.fallback.quando_cliente_pergunta_fora_do_playbook`  
 (`acao`, `mensagem`, `botoes[]` com 4 botões: comprar / preco / garantia / humano).  
 Se ausente/incompleto → `TG_FALLBACK_DEFAULT`.

## `detectaPerguntaForaDoPlaybook(userMessage, domain)` — L367

 Compara a fala com `data.faq[].pergunta` (Jaccard ≥ 0.6 = FAQ hit → não é fallback).

## `buildTelegramFacts(domain, env?, query?)` — RAG + fatos

Injeta fatos no `systemNote` do LLM. Com `env`+`query` também recupera a KB. Fontes:

| Linha facts | Origem |
|-------------|--------|
| `LOJA` | `hmap('cfg:{domain}:meta').brand` |
| `PRODUTOS` | `getProducts(domain)` (catálogo Redis; inclui `id`) |
| `GARANTIA` / `BENEFICIOS` / `NICHO` | `playbook(domain)` (`swarm:playbook:{dom}`) |
| `FAQ` (extras) | `loadStoreData(domain).faq[]` |
| `BASE DE CONHECIMENTO` | `kbRetrieve(domain, query, env)` — top-4 score ≥0.35 (Vectorize → espelho Redis `kb:{domain}`); `chunkText` **seção-first** (cada `##`/`###` = chunk, metadata `secao`) e `fillKbVars` substitui `{{VAR}}` (MAFEL-KB) pelos dados reais da loja |
| `LINK PAGAMENTO` | `buildPayLink(domain, productId)` → `pay?d={domain}` + `&p={id}` quando produto único tem `id` |

Retorno:

```js
{ brand, products, pb, payLink, facts /* string */, store, kbHits }
```

`facts` é a string pronta (uma linha por item) concatenada no systemNote.

## Fast-paths (sem LLM) — assinatura `(domain, text)`

| Função | Fonte | Link de pagamento |
|--------|-------|-------------------|
| `fastTelegramPriceReply` | `getProducts` + `playbook` (não lê o JSON direto) | **sim** (`buildPayLink` com `&p=` se produto único) |
| `fastTelegramGuaranteeReply` | **`loadStoreData` → `produtos[0].garantia.texto`** | **não** (linkPolicy) |
| `fastTelegramProductReply` | só nome/descrição do produto (`productRe`); `null` se não casar | **não** (linkPolicy) |

Preço e garantia **não** estão na mesma função: preço usa catálogo Redis; garantia usa o cadastro JSON.

## Uso no handler

- Compra / intent: `buildTelegramFacts` → link `payLink` (`&p=` dinâmico)
- Preço: fast-path → link com produto; garantia/produto: fast-path **sem** link
- Fora do playbook: **primeiro `kbRetrieve` (KB responde → `kb_rag_reply`)**; senão `getFallbackConfig` → 4 botões (`playbook_fallback`)
- Gate final antes de enviar: `applyLinkPolicy(reply, intent, text)` remove pay-link de garantia/FAQ/produto/geral

Pagamento Pix (`/chatpay/charge`, confirmação, `lookupTelegramPayment`): ver [`docs/pix-payment.md`](pix-payment.md).  
Blindagem fora do playbook / callbacks: ver [`docs/playbook-fallback.md`](playbook-fallback.md).
