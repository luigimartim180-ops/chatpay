# FASE I4 — Evidências para aprovação do arquiteto

## Contexto

Esta documento prepara evidências para uma nova rodada regression-gated (bandas N4–N10 em 0% no mock), conforme pendência P5 em AGENTS.md.

## Estado atual

### Última rodada real (FASE M, 2026-09-24)
- **Seed**: 20260910
- **Personas**: 20/20 completadas
- **Chamadas reais**: 100/100 via Groq (Cerebras 402 → fallback automático)
- **Gate de chamadas reais**: PASS (≥20 chamadas por batch)
- **Provider**: Groq (modelo de reasoning)
- **Qualidade**: 99/100 replies úteis, 1/100 vazia (diego-iniciante turno 1)

### Último report.json (seed 20260909, mock)
- **Gate geral**: FAIL
- **Gate de bandas**: N4–N10 em 0% (esperado no mock)
- **Gate de chamadas reais**: true (telemetry valida chamadas reais)
- **win_rate**: 0 (devido às bandas, não às chamadas reais)

## Diferença entre os dois gates (HANDOFF-REVISOR.md §4.3)

### Gate de chamadas reais (PASS)
- Conta chamadas **novas** de providers reais
- Default `--min-real-calls` = 20 por execução
- Último batch: `real_provider_calls: 25, gate_pass: true`
- FASE M: 100/100 chamadas reais, gate PASS em todos os batches

### Gate de bandas (FAIL, esperado)
- Valida win_rate por nível (N1–N10) contra bandas easy/medium/difficult/adversarial
- N1–N3 (easy): 60-90% ✅ (no mock: 90%, 90%, 90%)
- N4–N6 (medium): ≥30% ❌ (no mock: 0%, 0%, 0%)
- N7–N8 (difficult): ≥10% ❌ (no mock: 0%, 0%)
- N9–N10 (adversarial): 0 wins, 0 violations ✅ (no mock: 0%, 0%)
- **O win_rate: 0 é esperado no mock** - gate de bandas é escopo de FASE I4

## Análise de qualidade das replies (FASE M)

### Resumo
- Total de turnos: 100
- Respostas vazias: 1 (1.0%)
- Respostas curtas (<20 chars): 0 (0.0%)
- Respostas longas (>500 chars): 0 (0.0%)
- Alto reasoning (>50%): 96 (96.0%)

### Caso de resposta vazia
- **Persona**: diego-iniciante
- **Turno**: 1
- **Prompt**: "parece interessante"
- **Reasoning**: 798/800 tokens (99.8%)
- **Causa**: max_tokens=800, modelo gastou quase tudo em reasoning
- **Solução aplicada**: max_tokens aumentado de 300 → 800 (llm-providers.js)
- **Resultado**: melhorou de 6/25 vazias para 1/100 vazias

### Padrão de alto reasoning
- 96/100 turnos têm >50% de reasoning tokens
- Isso é esperado em modelos de reasoning (Groq provavelmente usando algum modelo o1-style)
- Recomendação: considerar max_tokens=1200 para margem maior

## Recomendação para FASE I4

### Não alterar bandas sem evidência
- A regra explicita: não alterar bandas sem evidência + aprovação do arquiteto
- As bandas N4–N10 em 0% no mock são esperadas
- Precisamos de uma rodada **real** (--require-real) com amostra adequada (n≥20 por nível)

### Separar os dois gates
- Gate de chamadas reais: PASS (já validado na FASE M)
- Gate de bandas: precisa de rodada real com providers reais
- Não confundir win_rate: 0 (bandas mock) com gate de chamadas reais (telemetry)

### Próximos passos
1. Aprovação do arquiteto para rodada regression-gated real
2. Executar: `node scripts/phase-e-simulator.js --seed 20260910 --require-real --personas-subset 20 --max-turns 10`
3. Analisar win_rate por nível com chamadas reais
4. Se bandas N4–N10 ainda em 0%, investigar causas específicas (prompt, personas, etc.)
5. Só então considerar ajuste de bandas com evidência

## Arquivos de evidência

- `simulator/batch-state.json` - evidência de chamadas reais (100/100)
- `simulator/report.json` - gate de bandas (win_rate: 0 esperado no mock)
- `scripts/analyze-mafel-quality.js` - análise de qualidade das replies
- `scripts/test-stt-diagnostic.js` - diagnóstico de STT (§4.1)

## Status atual

- ✅ Gate de chamadas reais: PASS (FASE M)
- ⏳ Gate de bandas: aguardando aprovação arquiteto + rodada real
- ⏳ Qualidade de replies: 99/100 úteis, 1 vazia (causa identificada)
