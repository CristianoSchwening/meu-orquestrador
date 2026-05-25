# Contrato de Execução do Orquestrador

Este documento define o **contrato canônico** entre `engine/` (backend Python) e `ui/` (frontend React) para tráfego de dados de execução.

## 1) Envelope do payload

Todo payload de resultado de execução deve conter:

- `contract_version` (string): versão semântica do contrato.
- `task` (objeto): metadados e estado da execução principal.
- `subtasks` (array): subtarefas planejadas/executadas.
- `events` (array): trilha cronológica de eventos do ciclo de execução.
- `metrics` (objeto): métricas agregadas para monitoramento e UX.
- `decision_metadata` (objeto): rastreabilidade de decisões automáticas e humanas.

## 2) Modelo de dados

### 2.1 `task`

Representa a unidade principal de orquestração.

Campos sugeridos:

- `id` (string)
- `objective` (string)
- `status` (`pending` | `running` | `completed` | `failed` | `blocked`)
- `created_at` (ISO-8601 string)
- `updated_at` (ISO-8601 string)
- `started_at` (ISO-8601 string | null)
- `completed_at` (ISO-8601 string | null)
- `owner` (string | null)
- `priority` (`low` | `medium` | `high` | `critical`)

### 2.2 `subtask`

Representa uma etapa executável da tarefa.

Campos sugeridos:

- `id` (string)
- `task_id` (string)
- `description` (string)
- `agent` (string)
- `tool_name` (string)
- `params` (objeto JSON)
- `depends_on` (array de string)
- `status` (`pending` | `running` | `completed` | `failed` | `blocked`)
- `attempt` (number)
- `started_at` (ISO-8601 string | null)
- `finished_at` (ISO-8601 string | null)
- `output` (qualquer JSON serializável | null)
- `error` (objeto | null)

### 2.3 `events`

Log de eventos de domínio para auditoria e timeline de execução.

Campos sugeridos por item do array:

- `id` (string)
- `type` (string; ex.: `task_started`, `subtask_completed`, `task_failed`)
- `task_id` (string)
- `subtask_id` (string | null)
- `timestamp` (ISO-8601 string)
- `payload` (objeto JSON)

### 2.4 `metrics`

Métricas para observabilidade e visão resumida no frontend.

Campos sugeridos:

- `total_subtasks` (number)
- `completed_subtasks` (number)
- `failed_subtasks` (number)
- `blocked_subtasks` (number)
- `running_subtasks` (number)
- `pending_subtasks` (number)
- `execution_time_ms` (number)
- `success_rate` (number de 0 a 1)

### 2.5 `decision_metadata`

Metadados para explicar decisões do orquestrador.

Campos sugeridos:

- `planner_version` (string)
- `router_version` (string)
- `execution_mode` (string; ex.: `SUBAGENT`, `TEAM`)
- `fallback_used` (boolean)
- `human_approval_required` (boolean)
- `human_approval_received` (boolean)
- `decision_trace` (array de objetos)
  - `step` (string)
  - `reason` (string)
  - `confidence` (number de 0 a 1)
  - `timestamp` (ISO-8601 string)

## 3) Estados e transições permitidas

Estados válidos para `task.status` e `subtask.status`:

- `pending`
- `running`
- `completed`
- `failed`
- `blocked`

Transições permitidas:

- `pending -> running`
- `pending -> blocked`
- `running -> completed`
- `running -> failed`
- `running -> blocked`
- `blocked -> pending`
- `blocked -> running`

Transições **não permitidas**:

- qualquer transição saindo de `completed` para outro estado
- qualquer transição saindo de `failed` para outro estado
- `pending -> completed` sem passar por `running`

## 4) Versionamento do contrato

### Regra

`contract_version` deve estar presente no payload raiz.

Exemplo:

```json
{
  "contract_version": "1.0.0"
}
```

### Estratégia recomendada

- **PATCH**: ajustes compatíveis sem impacto de integração.
- **MINOR**: adição de campos opcionais retrocompatíveis.
- **MAJOR**: quebra de compatibilidade (remoção/renomeação de campos, alteração de semântica).

### Compatibilidade engine/ui

- `ui/` deve validar a versão recebida e degradar graciosamente para campos desconhecidos.
- `engine/` deve evitar remover campos em versões MINOR/PATCH.
