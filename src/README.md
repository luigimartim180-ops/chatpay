# Estrutura futura (`src/`) — ChatPay

> **Status:** scaffold apenas. **Não é importado por `worker.js` em produção.**
> Ativação só com pedido explícito — ver `docs/roadmap/ROADMAP.md`.

## Árvore

```
src/
├── package.scaffold.json
├── config/
│   └── integrations-config.js      # nomes de secrets por fase
├── integrations/
│   ├── channels/
│   │   ├── telegram-shared.js      # Fase 1: deep link + session Redis
│   │   └── telegram-egress.js      # Fase 1: fila + token bucket 25 msg/s
│   ├── voice/
│   │   ├── voice-router.js         # Fase 2: prioridade pt-BR/en/zh
│   │   ├── vapi-integration.js     # Fase 2
│   │   ├── bland-integration.js    # Fase 2
│   │   └── iflytek-integration.js  # Fase 3 (auth HMAC pronta)
│   ├── ai/
│   │   └── baidu-ernie-integration.js  # Fase 3
│   └── spatial/
│       └── xreal-bridge.js         # Fase 4
└── services/
    ├── message-queue.js            # Fase 1: ingress padronizado
    └── conversation-service.js     # Fase 5: pipeline agnóstico
```

## Deep link (exemplo de uso — Fase 1)

```
https://t.me/ChatPayMasterBot?start=loja_joao
→ /start loja_joao
→ Redis session:{chat_id} = loja_joao (TTL 90d)
→ próximas mensagens → playbook/produtos de loja_joao
```

## O que JÁ funciona no worker (fora de src/)

- Telegram multi-cliente via **bot por cliente** + `?domain=`
- Onboarding: `scripts/onboard-telegram.ps1`
- Fast-path preço sem LLM

## Ordem de ativação

1. Fase 1 — shared bot + fila (quando escalar clientes Telegram)
2. Fase 2 — Vapi/Bland
3. Fase 3 — iFlytek/Baidu
4. Fase 4 — XREAL
5. Fase 5 — billing + dashboard + launch

**Não instalar `ws` nem gravar secrets até a fase correspondente.**
