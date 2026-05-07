# Insights de arquitetura (Google Cloud Agentic AI Design Patterns)

Fonte: https://docs.cloud.google.com/architecture/choose-design-pattern-agentic-ai-system?hl=pt-BR

## Recomendação principal para este projeto (`meu-orquestrador`)

O projeto atual já implementa bem o **núcleo de um padrão de coordenador simples**: um planejador gera subtarefas e um roteador escolhe agentes. Para evoluir com maior confiabilidade e previsibilidade de custo/latência, a melhor estratégia é adotar evolução incremental em 4 frentes.

## 1) Catálogo explícito de padrões suportados

Adicionar no `Workforce` um conceito de `execution_pattern` para tornar o comportamento previsível e configurável:

- `sequential`: subtarefas em sequência fixa.
- `parallel`: subtarefas independentes em paralelo.
- `review_critic`: gerador + crítico para validação de saída.
- `iterative_refinement`: múltiplos ciclos de melhora de resposta.
- `human_in_the_loop`: gate de aprovação para tarefas de alto risco.

**Benefício:** facilita escolher trade-offs por caso de uso (qualidade vs latência/custo), alinhado ao guia do Google.

## 2) Guardrails de loop e orçamento

Para padrões iterativos, incluir limites operacionais como contrato de execução:

- `max_iterations`.
- `max_model_calls`.
- `max_elapsed_ms`.
- política de parada por qualidade mínima (`quality_threshold`).

**Benefício:** reduz risco de loop infinito e de custo explosivo, explicitamente citado no padrão de loop.

## 3) Camada de validação/critério antes de concluir tarefa

Inserir um estágio opcional de crítica/validação entre execução e conclusão:

- avaliador de formato/estrutura de resposta.
- avaliador de política/safety.
- avaliador de testes (quando saída for código).

Se reprovar, reencaminhar para revisão (até o limite de iterações).

**Benefício:** melhora confiabilidade do output para fluxos sensíveis.

## 4) Telemetria orientada a decisão de padrão

Registrar métricas por subtask e por execução:

- latência por agente/tool.
- número de iterações.
- taxa de reprovação do crítico.
- custo estimado por task.

Com esses dados, fica possível aplicar a recomendação do documento de **revisar periodicamente** a escolha do padrão.

## Mapeamento prático para o código atual

- `planner`: hoje já define fluxos determinísticos; pode evoluir para produzir `plan metadata` (ex: dependências e critic_required).
- `task_router`: evoluir para roteamento dinâmico com fallback por capacidade do agente.
- `Subtask`: estender com `attempt`, `parent_subtask_id`, `quality_score`, `critic_feedback`.
- `WorkforceExecution`: incluir trilha de decisão e métricas agregadas.

## Sequência de implementação sugerida

1. **MVP de segurança operacional:** `max_iterations` + timeout global + tracking de chamadas.
2. **Padrão review/critic opcional:** apenas para subtasks marcadas como críticas.
3. **Execução paralela para subtasks independentes:** ganho de latência.
4. **Human-in-the-loop:** aprovação manual em tarefas com risco.
5. **Telemetria e painel simples:** fechar ciclo de melhoria contínua.

## Critério de decisão resumido

- Se o fluxo for previsível: comece com `sequential`/`parallel`.
- Se houver ambiguidade e necessidade de delegação dinâmica: evolua para `coordinator`.
- Se prioridade for qualidade: ative `review_critic` e `iterative_refinement` com limites rígidos.
- Se risco/compliance for alto: obrigue `human_in_the_loop`.
