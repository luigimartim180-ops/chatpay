# Política de rotação de chaves

## Chaves locais

1. Revogar a chave OpenRouter, Gemini e Groq no painel de cada provedor.
2. Criar novas chaves com escopo mínimo e limites de uso.
3. Armazenar em variáveis de usuário/máquina ou em `C:\secrets\chatpay-secrets`,
   nunca no workspace, código, print ou conversa.
4. Testar sem imprimir valores: `OPENROUTER_API_KEY=configured`.
5. Remover caches, logs e screenshots que contenham tokens.

## Secrets de produção

Configure `REDIS_URL`, `REDIS_TOKEN`, `RESEND_KEY`, `TARGET_EMAIL`,
`MIDAS_SECRET` e `JWT_SECRET` como Cloudflare Worker Secrets. O bundle deve
conter apenas nomes de bindings; nunca valores.

## Checklist pré-deploy

- [ ] nenhum arquivo de credencial anexado em conversa/print;
- [ ] nenhuma key hardcoded;
- [ ] laboratório nunca vira produção;
- [ ] `node test-production-provider-boundary.js` passa;
- [ ] testes sequenciais passam;
- [ ] rotação registrada fora do repositório.

## Cofre externo e limpeza

- Use `CHATPAY_SECRETS_FILE=C:\secrets\chatpay-secrets` somente fora do workspace.
- O loader local não procura arquivos de segredo no projeto.
- Use `wrangler secret put NOME` interativamente para produção.
- Após a rotação, remova transcripts, logs e screenshots que contenham tokens.
