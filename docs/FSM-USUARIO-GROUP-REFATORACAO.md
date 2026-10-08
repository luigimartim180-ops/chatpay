# Refatoração FSM por usuário em grupo (§4.6 HANDOFF-REVISOR)

## Problema atual

### Limitação conhecida
- FSM/tags/handoff são **por chat** (`tg:state:{chatId}`, `tg:tags:{chatId}`, `tg:handoff:{chatId}`)
- **Não por usuário**: em grupo, dois clientes distintos irritados (1 mensagem cada) podem disparar `handoff_irritado` para a sala inteira
- Consequência: bot pausado para todos até `/retomar`

### Exemplo de cenário problemático
1. Usuário A envia "isso é uma merda" → handoff_irritado (1ª mensagem)
2. Usuário B envia "não funciona nada" → handoff_irritado (2ª mensagem) → bot pausado para TODOS no grupo
3. Usuário C quer comprar → não recebe resposta até alguém fazer `/retomar`

## Schema atual (por chat)

```javascript
// worker.js ~496/502
await redis('SET', 'tg:state:' + chatId, JSON.stringify(state), 'EX', 90 * 24 * 60 * 60);
await redis('SADD', 'tg:tags:' + chatId, ...tags);
await redis('SET', 'tg:handoff:' + chatId, '1', 'EX', 7200);
```

## Schema proposto (por usuário em grupo)

### Chaves
- `tg:state:{chatId}:{userId}` - estado por usuário em grupo
- `tg:tags:{chatId}:{userId}` - tags por usuário em grupo
- `tg:handoff:{chatId}:{userId}` - handoff por usuário em grupo
- `tg:group:handoff:{chatId}` - handoff global do grupo (quando um usuário irrita, pausa só aquele usuário)

### Lógica
- Em chat privado: manter schema atual (`tg:state:{chatId}`)
- Em grupo: usar schema por usuário (`tg:state:{chatId}:{userId}`)
- Handoff: só pausar respostas para o usuário irritado, não para o grupo inteiro

## Impacto nos testes

### Testes que precisam atualização
- `test/test-phase2.js`:
  - P5/P6 (irritado 1x/2x) - precisam distinguir chat privado vs grupo
  - P7/P9 (handoff free text, /retomar) - precisam testar por usuário
  - P11 (anti-injeção) - impacto mínimo
- `test/test-phase1.js`:
  - G12 (dedup em grupo) - já está correto, não impacta
  - G1/G2 (bind via /start@bot) - impacto mínimo

### Novos testes necessários
- Teste de handoff por usuário em grupo (usuário A irritado, usuário B normal)
- Teste de /retomar por usuário em grupo
- Teste de dedup por usuário em grupo (opcional, já desativado em grupo)

## Complexidade

### Estimativa de esforço
- **Alta**: requer mudança de schema em múltiplos pontos do worker.js
- **Média**: requer atualização de testes phase2 (12 casos)
- **Baixa**: documentação e runbook

### Pontos críticos no worker.js
- Line ~496/502: `setTgState` / `getTgState` - precisam distinguir chat privado vs grupo
- Line ~535: `tg:handoff` - precisa ser por usuário em grupo
- Line ~2891: `isStart` - já suporta grupo, não impacta
- Line ~3351: `isGroupChat` - já existe, pode ser reutilizado

## Recomendação

### Quando fazer
- **Antes de escalar o canal de grupo**: o problema vai se tornar mais visível com mais usuários
- **Após validar FASE I4**: para não misturar frentes

### Como fazer
1. Criar branch `fsm-user-group`
2. Implementar schema por usuário apenas em grupo (manter privado como está)
3. Adicionar testes específicos para grupo
4. Validação manual em grupo real (criar grupo de teste)
5. Merge após aprovação

### Alternativa menos invasiva
- Manter handoff global no grupo, mas mudar lógica: require 3 mensagens de **um mesmo usuário** para disparar handoff
- Complexidade: baixa (só mudar contador de 2→3 + agrupar por userId)
- Impacto: menor, mas não resolve completamente (usuário muito irritado ainda pausa o grupo)

## Status atual

- ⏳ Decisão pendente: fazer refatoração completa ou mitigação simples?
- ⏳ Aprovação arquiteto necessária para mudança de schema
- ⏳ Prioridade: média (bloqueio só aparece ao escalar grupo)

## Evidência de necessidade

### HANDOFF-REVISOR.md §4.6
> "Por que ficou assim: corrigir exige mudar o schema de chaves para `{chatId}:{userId}` e refazer testes phase2 — decisão de **fase de teste**, documentada aqui para você avaliar se vale refatorar (provavelmente sim, antes de escalar o canal)."

### Testes atuais
- `test-phase2.js` P5/P6/P7/P9 assumem handoff por chat (não distinguem usuário)
- Não há teste de handoff por usuário em grupo
- Issue vai se tornar crítica ao escalar para grupos reais
