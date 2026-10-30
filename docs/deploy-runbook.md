# Runbook de deploy — ChatPay

**Regra:** repository-only nesta fase. Nenhum deploy é executado pelo editor.

## Sequência exata

1. **Humano:** configurar no ambiente do laboratório, sem registrar os valores:
   `setx OPENROUTER_API_KEY ...`, `setx GROQ_API_KEY ...`, `setx GEMINI_API_KEY ...`, `setx OWNER_EMAIL ...` e `setx CHATPAY_TOKEN ...`.
2. **Humano:** executar `wrangler secret put` para os seis nomes: `REDIS_URL`, `REDIS_TOKEN`, `RESEND_KEY`, `TARGET_EMAIL`, `MIDAS_SECRET` e `JWT_SECRET`.
3. **Editor:** executar `powershell -ExecutionPolicy Bypass -File scripts/predeploy-check.ps1`. O checklist precisa ficar totalmente verde.
4. **Editor:** após o humano configurar os providers, executar `node scripts/phase-e-simulator.js --require-real` e conferir `simulator/report-decisao.md`.
5. **Arquiteto:** registrar o carimbo/aprovação da rodada de referência neste documento ou no registro de mudança, sem valores secretos.
6. **Humano:** registrar a versão atualmente em produção abaixo, executar `wrangler deploy` e então, após autorização, executar `scripts/postdeploy-smoke.ps1` e `scripts/security-audit.ps1`. Ambos exigem `ALLOW_LIVE_API_TESTS=1` e `CHATPAY_API_BASE` explícito; smokes Telegram também exigem `BASE` e `TELEGRAM_WEBHOOK_SECRET`.

## Critérios de ABORTAR

- Qualquer `FAIL` no `predeploy-check` (qualquer um dos cinco itens).
- `--require-real` sem provider resolvível.
- Qualquer falha ou status inesperado no smoke pós-deploy.
- Token ausente, inválido ou email de owner ausente/malformado.

## Versão atualmente em produção

- **Version ID:** `29b1d54f-f280-40cd-a4b1-a10271c5096d`
- **Data/hora:** 2026-09-24 (deploy `wrangler deploy --name midas-core`)
- **Rollback imediato:** `6f296d08-3582-4bcb-871c-1673958f58f8` (deploy grupos + FASE M)
- **Gate do deploy:** `predeploy-check.ps1` PASS (phase1 **33/33**, phase2 22/22, phase3 20/20, phase4 14/14, social 10/10, channels 32/32, v22/v23) · pós-deploy: `postdeploy-smoke.ps1` 6/6 PASS · smoke ao vivo 10/10 + 12 personas 17/17.
- **Mudança:** Canais sociais operacionais (Instagram, YouTube, TikTok), endpoint universal de captura `/api/hunter-lead` com IA e novo painel de gestão de redes no Dashboard.
- **Aprovador/arquiteto:** regressão verde + smoke ao vivo autorizado (banda/win_rate da FASE M segue escopo do P5/I4). Smokes exigem `ALLOW_LIVE_API_TESTS=1`, `BASE` e `TELEGRAM_WEBHOOK_SECRET`; não executar até rotacionar o segredo previsível legado `tg__shared`.

## Manutenção do índice Vectorize (`kb-midas-core`)

Se qualquer KB mudar de tamanho, vetores de índices antigos ficam **órfãos** (ex.: 2026-09-24, MAFEL 35→16 chunks). Fluxo:

```powershell
# 1) Conferir estado atual (22 esperados: chatpay.kb.md 6 + MAFEL-KB.md 16)
npx.cmd wrangler vectorize list-vectors kb-midas-core

# 2) Deletar os IDs antigos (prefixo domain:file:i)
npx.cmd wrangler vectorize delete-vectors kb-midas-core --ids 'chatpay.oficial:MAFEL-KB.md:0' ...

# 3) Re-upload dos docs (UTF-8, valida chunks>=2)
powershell -ExecutionPolicy Bypass -File scripts\upload-kb.ps1 -Domain chatpay.oficial -File data\chatpay.kb.md
powershell -ExecutionPolicy Bypass -File scripts\upload-kb.ps1 -Domain chatpay.oficial -File docs\kb\MAFEL-KB.md
```

Se o índice for apagado/criado do zero, recriar o índice de metadata: `npx.cmd wrangler vectorize create-metadata-index kb-midas-core --propertyName=domain --type=string`.

## Rollback

1. Interromper novos testes de produção.
2. Registrar o Version ID que está sendo revertido e o motivo.
3. Executar: `wrangler rollback <version-anterior>`.
4. Com autorização, `ALLOW_LIVE_API_TESTS=1` e `CHATPAY_API_BASE` explícito configurados, reexecutar `scripts/postdeploy-smoke.ps1` e registrar o resultado; não usar alvo padrão de produção.

Nunca inserir tokens, chaves, emails ou conteúdo de arquivos de segredo neste documento.
