# Arquitetura Greenfield do Orquestrador de Agentes (ADK-only)

## 1) Arquitetura alvo (visão em camadas)

```text
┌─────────────────────────────────────────────────────────────────────┐
│                           Canais de Entrada                         │
│  Web App / API Clients / Slack / CLI / Sistemas internos           │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    ADK App Gateway (Entry Agent)                    │
│  - AuthN/AuthZ                                                      │
│  - Idempotência de request                                          │
│  - Criação/lookup de Session                                        │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  Orchestrator Agent (ADK Workflow)                  │
│  Pattern Router:                                                     │
│   - Sequential Workflow                                              │
│   - Parallel Workflow                                                │
│   - Loop/Refinement Workflow                                         │
│   - Human-in-the-loop Workflow                                       │
│                                                                     │
│  Decision Policy Engine:                                             │
│   - seleção de padrão                                                │
│   - orçamento/guardrails (tempo, iterações, custo)                  │
└───────────────┬─────────────────────┬─────────────────────┬─────────┘
                │                     │                     │
                ▼                     ▼                     ▼
┌─────────────────────────┐ ┌─────────────────────────┐ ┌─────────────────────────┐
│ Specialist Agent A      │ │ Specialist Agent B      │ │ Specialist Agent C      │
│ (Research/Analysis)     │ │ (Execution/Tooling)     │ │ (Validation/Critic)     │
│ Tools + MCP connectors  │ │ Tools + MCP connectors  │ │ Eval criteria/policies  │
└───────────────┬─────────┘ └───────────────┬─────────┘ └───────────────┬─────────┘
                │                           │                           │
                └───────────────┬───────────┴───────────┬───────────────┘
                                ▼                       ▼
                    ┌──────────────────────┐   ┌──────────────────────┐
                    │ ADK Sessions/State   │   │ ADK Artifacts        │
                    │ - short-term context │   │ - outputs/versioning │
                    │ - workflow memory    │   │ - files/evidence     │
                    └───────────┬──────────┘   └───────────┬──────────┘
                                │                          │
                                ▼                          ▼
                      ┌───────────────────────────────────────────┐
                      │ Observability + Evaluation Layer (ADK)    │
                      │ - traces/events                            │
                      │ - custom metrics                           │
                      │ - regression benchmarks                    │
                      └───────────────────────────────────────────┘
```

## 2) Fluxo principal (end-to-end)

1. Client envia objetivo ao Gateway ADK.
2. Gateway resolve/cria Session.
3. Orchestrator Agent classifica tarefa e escolhe padrão (`sequential`, `parallel`, `loop`, `hitl`).
4. Orchestrator delega para Specialist Agents.
5. Agentes usam Tools/MCP e escrevem resultados em Artifacts.
6. Estado compartilhado vive em Session/State/Memory.
7. Se precisar revisão, entra em Critic Agent e ciclo de refinement.
8. Se risco alto, aciona Human Input Node.
9. Resultado final é consolidado e devolvido ao cliente.
10. Tudo é registrado na camada de observabilidade/evaluation.

## 3) Mapeamento de responsabilidades (ADK-only)

- Coordenação: Workflow Agent (orquestrador).
- Roteamento de padrão: Policy + workflow branching.
- Delegação multiagente: Multi-agent workflows.
- Contexto compartilhado: Sessions + State + Memory.
- Persistência de entregáveis: Artifacts.
- Ferramentas externas: MCP.
- Aprovação humana: Human input workflow node.
- Qualidade contínua: Evaluation com métricas custom.

## 4) Topologia recomendada de agentes

- Entry Agent: saneamento, autorização, sessão.
- Planner/Orchestrator Agent: decide fluxo.
- Executor Agents (N): executam subtarefas por domínio.
- Critic Agent: valida formato/política/qualidade.
- Compliance Agent (opcional): regras regulatórias.
- Summarizer Agent: consolidação final para usuário.

## 5) Guardrails essenciais

- Max iterações por workflow.
- Timeout total por sessão/execução.
- Budget de chamadas de modelo.
- Política de fallback em erro de tool/MCP.
- Circuit breaker para dependências externas.
- HITL obrigatório para ações de alto impacto.

## 6) Blueprint de ambientes

- Dev: sessões in-memory, artifacts locais.
- Staging: persistência real + datasets de avaliação.
- Prod: HA, observabilidade completa, políticas restritas.
