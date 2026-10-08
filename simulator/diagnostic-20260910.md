# Diagnóstico da rodada real — seed 20260910

**Fonte:** `simulator/report.json` gerado por `--require-real --personas-subset 6 --max-turns 5`.

**Regra de evidência:** este relatório não inventa conversões, confirmações, falas ou rewards. Quando o relatório-base não contém o campo, o resultado é `N/D`.

## 1. Classificação por nível

A amostra observada foi `n=6` por nível. Com `n=6`, não há base suficiente para um intervalo de confiança operacional. Portanto, a classificação primária de todos os níveis é `STATISTICAL_FAIL`, sem ajustar bandas.

| Nível | Banda | n | Win rate observado | Violações | Classificação | Evidência adicional |
|---:|---|---:|---:|---:|---|---|
| N1 | easy | 6 | 1.0000 | 0 | STATISTICAL_FAIL | acima do teto da banda; amostra insuficiente |
| N2 | easy | 6 | 0.8333 | 0 | STATISTICAL_FAIL | dentro da faixa nominal; amostra insuficiente |
| N3 | easy | 6 | 1.0000 | 0 | STATISTICAL_FAIL | acima do teto da banda; amostra insuficiente |
| N4 | medium | 6 | 0.0000 | 0 | STATISTICAL_FAIL | abaixo da faixa nominal; amostra insuficiente |
| N5 | medium | 6 | 0.0000 | 0 | STATISTICAL_FAIL | abaixo da faixa nominal; amostra insuficiente |
| N6 | medium | 6 | 0.0000 | 0 | STATISTICAL_FAIL | abaixo da faixa nominal; amostra insuficiente |
| N7 | difficult | 6 | 0.0000 | 0 | STATISTICAL_FAIL | abaixo da faixa nominal; amostra insuficiente |
| N8 | difficult | 6 | 0.0000 | 0 | STATISTICAL_FAIL | abaixo da faixa nominal; amostra insuficiente |
| N9 | adversarial | 6 | 0.0000 | 0 | STATISTICAL_FAIL | sem violação, mas amostra insuficiente |
| N10 | adversarial | 6 | 0.0000 | 0 | STATISTICAL_FAIL | sem violação, mas amostra insuficiente |

`QUALITY_FAIL` não pode ser concluído com esta amostra. `RECONCILIATION_FAIL` também não pode ser concluído: o relatório não contém evento `paid` nem confirmação simulada.

### Conversões e confirmações

- Conversões reais com lead em `pago` e evento `paid`: **0 registradas**.
- Confirmações via evento `paid` + `/confirm` simulado: **0 registradas**.
- `paid_events`: lista vazia.
- `paid_reconciliation`: `false`, mas isso é ausência de evidência de pagamento, não prova de falha de reconciliação.
- Um cenário terminou em `pago` no grafo sintético; ele não deve ser contado como pagamento real porque não há evento `paid` correspondente.

## 2. Heatmap persona x estágio final

| Persona | Estágio final | Contagem de turnos observados |
|---|---|---:|
| ana-curiosa | quase | 5 |
| bruno-direto | quase | 5 |
| carla-preco | quase | 5 |
| diego-iniciante | pago | 5 |
| elisa-cetica | quase | 5 |
| fabio-ocupado | quase | 5 |
| troll-never-buyer | quase | 2 |
| never-buyer | quase | 2 |
| scout-unknown | comparando | 1 |

Resumo dos estágios finais: `quase=7`, `pago=1`, `comparando=1`.

## 3. Distribuição de plays

| Play | Seleções observadas |
|---|---:|
| MirrorOpener | 15 |
| LabelEmpathy | 13 |
| CalibratedQuestion | 6 |
| LastMileClose | 1 |

O relatório não preserva uma relação completa `nível -> persona -> estágio -> play` para cada execução; os números acima são o agregado disponível nos turnos observados.

## 4. Top-10 quase-perdas

**N/D na rodada atual.** `report.json` não contém a fala/resposta final do Hunter, nem um registro de score antes/depois associado a `quase_perda`. O campo `top_risk_moments` da fase sintética não substitui a fala exata do Hunter e não será usado como se substituísse.

## 5. LastMileClose

- Acionamentos observados: **1**.
- Score no acionamento: **N/D**.
- Conversão com LastMileClose: **N/D**.
- Conversão sem LastMileClose: **N/D**.
- Conclusão: há sinal de seleção do play, mas não há dados de pagamento/reconciliação para estimar eficácia.

## 6. Bandit

- Reward médio por play: **N/D**; o relatório contém reward por nível/banda, não `reward_sum` por play.
- Braço vencedor: **N/D** nesta rodada.
- Explore/exploit: configuração observada `epsilon=0.2` e `exploration_trials_per_arm=50` por nível; razão efetiva por play: **N/D**.
- Leitura: não há evidência suficiente para afirmar aprendizado ou aprisionamento do bandit.

## 7. Scout

- Unknowns capturados: **1**.
- Sugestões geradas/aprovadas: **N/D**; o relatório-base não contém a lista nem o estado das sugestões.

## 8. Telemetria e qualidade da evidência

- `llm_calls`: **30**.
- `tokens`: **3492**.
- Providers observados: 29 chamadas OpenRouter e 1 Groq.
- Cache hits: 0.
- Gate de telemetria: **PASS**.
- Gate geral da rodada: **FAIL**, por bandas e ausência de reconciliação confirmada.

## 9. Decisões para o fundador

### Decisão 1 — aumentar a amostra antes de mexer nas bandas

- **Opção A (recomendada):** repetir com seed fixo e amostra maior por nível, preservando as bandas atuais. Consequência: permite separar variância estatística de falha de qualidade.
- **Opção B:** manter `n=6` e interpretar as taxas como decisão operacional. Consequência: alto risco de overfitting e falso diagnóstico.
- **Risco de não decidir:** alterar o Hunter ou as bandas com evidência estatística fraca.

### Decisão 2 — instrumentar o relatório por play e fala

- **Opção A (recomendada):** registrar `reply`, score antes/depois, `node_after`, play, persona e quase-perda por turno, sem segredos. Consequência: habilita Top-10, LastMileClose e reward por play reais.
- **Opção B:** continuar usando apenas os agregados atuais. Consequência: decisões sobre plays permanecem inconclusivas.
- **Risco de não decidir:** substituir um play sem evidência de que ele é ineficaz.

### Decisão 3 — separar conversão de reconciliação

- **Opção A (recomendada):** adicionar ao simulador uma trilha explícita `paid_emitted`, `confirm_simulated`, `reconciled` e `win_counted`, com asserts de consistência. Consequência: distingue `RECONCILIATION_FAIL` de ausência de pagamento.
- **Opção B:** tratar `final_node=pago` como conversão. Consequência: mistura grafo sintético com pagamento real e pode mascarar falha de reconciliação.
- **Risco de não decidir:** liberar uma rodada cujo win rate não é auditável.

## Próxima rodada regression-gated

Aguardando aprovação do arquiteto das três decisões. Depois da aprovação: repetir com seed fixo, aumentar a amostra conforme Decisão 1, comparar o diff contra este relatório e liberar carimbo somente se houver melhora mensurável. Nenhuma banda foi alterada e nenhum deploy foi executado.
