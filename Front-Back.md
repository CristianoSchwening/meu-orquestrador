⚠️ Discrepâncias que precisam de atenção
1. WorkforceExecution — campos no frontend que o Python não persiste
O Python armazena na WorkforceExecution apenas: task_id, subtasks, mode, events, decision_metadata, metrics.

O frontend espera também:

task_name: string      // não existe no Python
objective: string      // passado para execute(), mas não salvo
pattern: ExecutionPattern  // está em Workforce, não em WorkforceExecution
agent_ids: string[]    // idem — em Workforce, não em WorkforceExecution
created_at: string     // não existe
updated_at: string     // não existe
Solução: Quando a API for construída, o endpoint POST /executions precisa receber esses campos e retorná-los junto na resposta (como metadados da execução, não da engine interna).

2. Eventos sem timestamp
O Python gera eventos assim:

{"type": "subtask_completed", "subtask_id": "...", "agent": "..."}
Sem timestamp. O frontend assume que todos os eventos têm timestamp: string.

Solução: Adicionar no backend ao emitir cada evento:

"timestamp": datetime.now(timezone.utc).isoformat()
3. Agent.toolkit — simplificação correta
Python	Frontend
toolkit: Toolkit (objeto com .tools: Dict[str, Tool])	toolkit: string[] (lista de nomes)
A simplificação está correta para a UI. Na integração real, o backend pode retornar list(agent.toolkit.tools.keys()).

4. Campos UI-only no frontend (sem equivalente no Python — correto assim)
Agent.id, .description, .tags, .color, .avatar
Tool.description, .category, .params
WorkforceConfig.id, .name, .has_critic, .has_human_gate, .has_dynamic_router
Esses são metadados de configuração/UI que o backend precisaria salvar num banco (quando Supabase ou outro persistidor for adicionado).

Resumo executivo
O frontend está muito bem modelado em relação ao backend. Os tipos críticos de execução (Subtask, DecisionMetadata, ExecutionMetrics, todos os event types) batem perfeitamente. Os únicos ajustes necessários para integração real são:

Backend: Enriquecer WorkforceExecution com objective, pattern, agent_ids, task_name, created_at, updated_at na camada de API
Backend: Adicionar timestamp em todos os eventos emitidos
Backend: Expor agent.toolkit.tools.keys() como lista de strings no endpoint de agentes
