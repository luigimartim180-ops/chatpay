# Relatório de decisão

## Resumo executivo
- Seed: 20260909
- Gate geral: FAIL

## Gates F1-F8
- Bandas: FAIL
- F1 por nível: N1 n=20: FAIL; N2 n=20: FAIL; N3 n=20: FAIL; N4 n=20: FAIL; N5 n=20: FAIL; N6 n=20: FAIL; N7 n=20: FAIL; N8 n=20: FAIL; N9 n=20: FAIL; N10 n=20: FAIL
- Telemetria LLM: FAIL (indisponível)
- Telemetria: 0 tokens, 0 llm_calls, custo R$ 0
- Scout desconhecidos: 1

## Pagamentos e reconciliação
- Eventos pagos emitidos: 61
- Reconciliação confirmada: sim

## Bandit e lições
- Recompensas no intervalo [0,1]: sim
- Lições de perdas: 0

## Sugestões regression-gated
- Regression gate ativo: sim

## Scout desconhecidos
- Capturas: 1

## Top-3 lições de perda
- diego-iniciante T6: fala exata do Hunter indisponível no simulador determinístico; entrada observada: "vou pagar agora"
- joao-tecnico T6: fala exata do Hunter indisponível no simulador determinístico; entrada observada: "quero pagar"
- lara-urgente T6: fala exata do Hunter indisponível no simulador determinístico; entrada observada: "preciso pagar agora"

## Matriz de plug
- Consulte `docs/plug-audit.md`; agentes de produção resolvem Workers AI -> Pollinations e o laboratório usa a cadeia local documentada.

## Limitações e evidências
- Nenhuma chave real foi usada nesta geração; o relatório não fabrica telemetria.
