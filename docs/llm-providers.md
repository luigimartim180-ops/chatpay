# FASE G — provedores LLM do laboratório

Esta etapa é somente um simulador local. `worker.js` não importa este módulo e o
comportamento de produção não muda.

## OpenRouter grátis

Defina a chave apenas em variável de usuário/máquina ou em um arquivo externo
indicado por `CHATPAY_SECRETS_FILE` (nunca dentro do workspace):

```powershell
$env:OPENROUTER_API_KEY = "..."
$env:CHATPAY_SECRETS_FILE = "C:\secrets\chatpay-secrets" # opcional
$env:OPENROUTER_MODEL = "nex-agi/nex-n2.5-mini:free" # opcional
node scripts/phase-e-simulator.js --provider=openrouter --personas-subset=6 --max-turns=5
```

O modelo padrão é `nex-agi/nex-n2.5-mini:free`. Respostas 503/erros
seguem para Gemini, Groq, Workers AI, Pollinations e, por último, o mock determinístico. Sem
`OPENROUTER_API_KEY`, OpenRouter é explicitamente ignorado. O mock é marcado
`unavailable`; não é evidência de qualidade LLM.

Uso e quota: mantenha os defaults de 6 personas x 5 turnos, faça execuções
pequenas e respeite os limites exibidos no painel OpenRouter. O cache
`simulator/cache.json` usa SHA-256 de `seed + turn + hash do prompt`; hits não
geram chamadas nem custo.

Tokens e custo projetado vêm do campo `usage` quando o provedor o fornece.
Modelos `:free` têm custo projetado zero, mas tokens continuam contabilizados.
Um `reference-report.json` só é gravado quando uma chave real está presente;
sem chave, o resultado informa `unavailable` e nenhum relatório é fabricado.

## Gemini e Groq locais

As chaves ficam somente em variáveis de ambiente ou no cofre externo:

```powershell
$env:GEMINI_API_KEY = "sk-test-fixture"
$env:GEMINI_MODEL = "gemini-flash-latest"
$env:GROQ_API_KEY = "sk-test-fixture"
$env:GROQ_MODEL = "openai/gpt-oss-20b"
```

Revogue imediatamente qualquer chave que tenha sido colada em chat, issue,
terminal compartilhado ou repositório. O código nunca imprime esses valores.
