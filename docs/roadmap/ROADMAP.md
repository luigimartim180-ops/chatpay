# Roadmap ChatPay — Multicanal, Voice AI & Spatial (90 dias)

> **Status:** ESTRUTURA MAPEADA — implementação só quando solicitado.
> Worker em produção (Telegram multi-cliente + fast-path) **não é bloqueado** por este roadmap.

---

## Visão Geral

| Fase | Prazo | Foco | Status |
|------|-------|------|--------|
| 0 | Em curso | Telegram multi-cliente + fast-path | ✅ Ativo |
| 1 | Semana 1-2 | Shared Bot + Deep Link + Fila | ✅ Ativo |
| 2 | Semana 3-4 | Voice AI EUA (Vapi/Bland) | ✅ Concluída (2026-09-26) |
| 2b | Semana 4 | WhatsApp CoEx (bot + humano) | ✅ Código pronto (2026-09-26) · ⏳ falta CoEx ativo na Meta |
| 3 | Semana 5-6 | APIs chinesas (iFlytek/Baidu) | ⬜ Aguarda pedido |
| 4 | Semana 7-8 | XREAL + Spatial | ⬜ Aguarda pedido |
| 5 | Semana 9-12 | Integração core + lançamento | ⬜ Aguarda pedido |

---

## Fase 0 — Produção atual (✅)

- [x] Telegram webhook multi-tenant (`?domain=`)
- [x] Onboarding 1 bot/cliente (`scripts/onboard-telegram.ps1`)
- [x] Fast-path preço/link sem LLM (~400-900ms)
- [x] Function calling + playbook por domínio
- [x] Testes v22 / v22.1 / v22.2 / v23

---

## Fase 1 — Shared Bot + Deep Link + Fila (✅)

### Problema
1.000 bots individuais = gargalo BotFather (20-50 bots/conta) + webhooks + DevOps.

### Solução (ativa no `worker.js`)
1. **Master Bot único** — deep link `t.me/Bot?start={domain}` (`POST /api/telegram/master`)
2. **Redis** `session:{chat_id}` → `domain` (TTL 90d) — bind em `/start {domain}`
3. **Fila** `queue:telegram` — egress com token bucket ≤25 msg/s; envio bloqueado → enqueue + `waitUntil(drain)`

### Endpoints Fase 1
| Endpoint | Auth | Função |
|----------|------|--------|
| `POST /api/telegram/master` | JWT | Configura master bot + setWebhook `?domain=_shared` |
| `GET /api/telegram/deep-link?token=&domain=` | JWT | Gera `t.me/Bot?start={domain}` + QR |
| `GET /api/telegram/queue?token=` | JWT | Profundidade da fila e limites |
| `POST /api/telegram-webhook?domain=_shared` | secret | Shared bot: sessão + deep link |

### Arquivos
- Ativo: `worker.js` (helpers Fase 1 + webhook shared + endpoints)
- Cadastro da loja: `data/chatpay.oficial.json` + espelho `EMBEDDED_STORES` — consumo em [`docs/store-data.md`](../store-data.md)
- Blindagem FAQ/fallback: [`docs/playbook-fallback.md`](../playbook-fallback.md)
- Scaffold de referência: `src/integrations/channels/telegram-{shared,egress}.js`
- Teste: `node test\test-phase1.js`

### Fluxo

```
/start loja_joao → Redis session:chat → domain
msg seguinte     → resolve domain → fast-path | LLM → sendTelegramLimited | enqueue → drain
```

### Proteções
- Whitelist `domainActive` (meta | playbook | produtos | token | default)
- Rate limit `/start` (5/min/chat)
- Sanitização domain: `/^[a-z0-9._-]{2,60}$/`
- Rate limit egress ≤25 msg/s (`rl:tg:out:{sec}`)
- Queue com prioridade (`price` > `start` > `general`)

**Meta:** onboarding cliente = 2s (deep link), 1 webhook só.

---

## Fase 2 — Voice AI EUA (Semana 3-4) ✅

| Provider | URL | Auth | Custo | Free |
|----------|-----|------|-------|------|
| Vapi | https://dashboard.vapi.ai | Bearer `VAPI_API_KEY` | ~$0.05/min | $5 crédito |
| Bland | https://www.bland.ai | Bearer `BLAND_API_KEY` | ~$0.10/min | ver site |

### Cadastros
- [ ] Vapi (Google/GitHub sign-in) — **pendente credencial real**
- [ ] Bland (email) — **pendente credencial real**
- [ ] Obter `VAPI_ASSISTANT_ID`, `PATH_ID` — **pendente**

### Código ✅
- `src/integrations/voice/vapi-integration.js` ✅ aperfeiçoado (getCallStatus, endCall, getTranscript)
- `src/integrations/voice/bland-integration.js` ✅ aperfeiçoado (getCallStatus, endCall, getTranscript)
- `src/integrations/voice/voice-router.js` ✅ `routeCall` inline em worker.js
- Endpoint: `POST /api/voice/call` ✅ + `GET /api/voice/calls` + `GET /api/voice/call/{id}` + `POST /api/voice/config`

### Teste ✅
```json
POST /api/voice/call
{ "phoneNumber": "+5511999999999", "language": "pt-BR", "useCase": "sales" }
```
- [x] `node --check worker.js` PASS
- [x] `predeploy-check.ps1` PASS 100%
- [ ] 1 ligação real de ~30s para medir custo por ligação qualificada — **bloqueio externo (usuário)**

---

## Fase 2b — WhatsApp CoEx (bot + humano no mesmo número) ✅

**Objetivo:** o mesmo número atende pelo bot (IA) e pelo atendente humano, como a OnlyFlow faz.

### Código ✅ (2026-09-26)
- Core CoEx em `worker.js` — `getCoexConfig`, `coexTriggersHuman/Bot`, `coexSetHuman/ClearHuman`,
  `coexIsHuman`, `coexActiveList`
- Estado por contato `wa:coex:human:{dom}:{from}` (TTL) + índice `wa:coex:index:{dom}`
- `POST /webhook/whatsapp` com ordem: devolução ao bot → handoff → silêncio do bot → fast-path
- Endpoints: `POST/GET /api/wa-coex/config` · `GET /api/wa-coex/metrics` ·
  `POST /api/wa-coex/handoff` · `GET /api/wa-coex/active`
- Card "🔀 WhatsApp CoEx" no `/dash` (toggle, gatilhos, TTL, métricas, conversas ativas)
- Guia do cliente: `docs/GUIA-WHATSAPP-COEX.md`

### Teste ✅
- [x] `test/test-wa-coex.js` **41/41 PASS**
- [x] `node --check worker.js` PASS
- [x] `predeploy-check.ps1` PASS 100% (590 testes)
- [ ] CoEx ativado no número via Meta Business Manager + checklist §8 do guia — **bloqueio externo**

### Ganho
- Handoff transparente sem trocar de número nem criar chip/app novo.
- Métricas de `handoff_rate_pct` e `avg_resolution_ms` dimensionam o time humano.
- 3 bugs preexistentes do WhatsApp corrigidos no caminho (texto de IA descartado, alias de
  validação quebrado, segredos em texto puro).

---

## Fase 3 — APIs Chinesas (Semana 3-4) ⬜

| Provider | URL | Auth | Free tier |
|----------|-----|------|-----------|
| iFlytek | https://console.xfyun.cn · https://www.xfyun.cn | HMAC-SHA256 | 500k chars/mês |
| Baidu ERNIE | https://console.bce.baidu.com | OAuth2 client_credentials | ~1k req/mês |

### Cadastros
- [ ] iFlytek (telefone CN ou portal intl `api.iflytek.com`)
- [ ] Baidu (email internacional)

### Código (quando iniciar)
- `src/integrations/voice/iflytek-integration.js` (TTS/STT WebSocket)
- `src/integrations/ai/baidu-ernie-integration.js` (chat + image)
- Atualizar `VoiceRouter` prioridade: `pt-BR: [vapi, iflytek, bland]`, `zh-CN: [iflytek, baidu]`

### Auth iFlytek (resumo)
```
signature = HMAC-SHA256(api_secret, "host:...\ndate:...\nGET path HTTP/1.1")
Authorization: api_key="...", algorithm="hmac-sha256", headers="...", signature="..."
```

### Auth Baidu (resumo)
```
POST /oauth/2.0/token?grant_type=client_credentials&client_id=&client_secret=
→ access_token (30 dias)
```

---

## Fase 4 — XREAL / Spatial (Semana 5-6) ⬜

| Item | URL | Status |
|------|-----|--------|
| XREAL SDK | https://developer.xreal.com | Free SDK |
| Apple Vision Pro | https://developer.apple.com/visionos/ | $99/ano |
| Meta Quest | https://developers.meta.com/horizon | Free |
| BrainCo | https://www.brainco.cn | Early — newsletter |

### Código (quando iniciar)
- `src/integrations/spatial/xreal-bridge.js` (WebSocket)
- Endpoints: `POST /api/spatial/notification`, `POST /api/spatial/product`

---

## Fase 5 — Integração Core + Lançamento (Semana 7-12) ⬜

- [ ] `conversation-service.js` — voice + multimodal + spatial
- [ ] `billing-service.js` — custo por provider + revenue share
- [ ] Dashboard analytics (duração, custo, conversão)
- [ ] Add-on premium Voice AI (R$500-1.000/mês)
- [ ] Monitor BCI/spatial 2027+

---

## Custos vs Receita (projeção)

### Custos API (USD/mês)
| Provider | Uso | Custo |
|----------|-----|-------|
| Vapi | 1k calls × 5 min × $0.05 | $250 |
| Bland | 500 × 5 min × $0.10 | $250 |
| iFlytek | 10k min × $0.01 | $100 |
| Baidu | 50k req × $0.001 | $50 |
| XREAL | Free | $0 |
| **Total** | | **~$650** |

### Receita add-ons (BRL/mês)
| Add-on | Clientes | Preço | Receita |
|--------|----------|-------|---------|
| Voice AI | 20 | R$800 | R$16.000 |
| Multimodal | 15 | R$500 | R$7.500 |
| Spatial | 10 | R$300 | R$3.000 |
| **Total** | | | **R$26.500** |

**Margem bruta ≈ 87%**

---

## Checklist global (só ao iniciar fases)

### Cadastros
- [ ] Vapi · Bland · iFlytek · Baidu · XREAL
- [ ] BrainCo (monitorar) · Apple VPro ($99) · Meta Quest (free)

### Código
- [ ] voice-router + 3 providers voice
- [ ] baidu-ernie + xreal-bridge
- [x] deep-link shared bot + fila Redis (Fase 1)
- [ ] env keys (via Wrangler secrets, **nunca** commitadas)
- [ ] testes unitários + endpoints + dashboard

### Testes E2E
- [ ] Voice call pt-BR
- [ ] TTS/STT iFlytek
- [ ] ERNIE multimodal
- [ ] XREAL notification (sim/hardware)
- [x] Shared bot: 2 domínios no mesmo bot (coberto por `test/test-phase1.js` + E2E prod)

---

## Regras de ouro

1. **Não commitar `.env` / secrets** (já há teste `test-production-provider-boundary.js`).
2. **Nenhuma fase 2-5 inicia sem pedido explícito.**
3. **Worker de produção** (Telegram multi-cliente) permanece estável; integrações novas ficam em `src/` até wiring.
4. URLs dos portais: validar manualmente (5 min/portais) antes de codar.
5. Preferir **Wrangler secrets** para VAPI/BLAND/IFLYTEK/BAIDU.
