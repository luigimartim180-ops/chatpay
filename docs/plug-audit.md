# Auditoria de plug dos agentes

Escopo: `worker.js` em produção e `scripts/llm-providers.js` no laboratório.

| Agente | Ambiente | Provider chain resolvido | Teste que prova a chamada |
|---|---|---|---|
| classifyIntent | prod | Workers AI -> Pollinations | `test-production-provider-boundary.js` |
| craftReply | prod | Workers AI -> Pollinations | `test-production-provider-boundary.js` |
| honestyJudge | prod | Workers AI -> Pollinations | `test-production-provider-boundary.js` |
| objectionHandler | prod | Workers AI -> Pollinations | `test-production-provider-boundary.js` |
| selectPlay/rewardPlay | prod | Workers AI -> Pollinations quando há inferência | `test-v23.js` |
| Scout | prod | Workers AI -> Pollinations quando há inferência | `test-v23.js` |
| Analyst | prod | Workers AI -> Pollinations quando há inferência | `test-v23.js` |
| persona-lead-LLM | lab | OpenRouter -> Gemini -> Groq -> Workers AI -> Pollinations -> mock | `test-v23-simulator.js` + rodada real |
| generateNextLeadMessage | prod | Workers AI -> Pollinations | `test-production-provider-boundary.js` |
| LastMileClose | prod | Workers AI -> Pollinations | `test-v23.js` |

O mock é permitido somente no laboratório quando todos os provedores reais
falham ou estão ausentes. O Worker não contém nomes, chaves ou endpoints dos
provedores de laboratório.
