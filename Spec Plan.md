🗺️ Plano de Desenvolvimento — Workforce Execution Dashboard
📐 Visão Geral da Interface
Uma SPA (Single Page Application) com React + TypeScript + Tailwind CSS, organizada em seções para configurar, executar e monitorar Workforces multi-agente em tempo real.

🧱 Entidades Mapeadas do Código
Entidade Python	Representação na UI
TaskStatus	Badge colorido (PENDING=cinza, RUNNING=azul, COMPLETED=verde, FAILED=vermelho, BLOCKED=âmbar)
ExecutionPattern	Selector visual com ícones e descrição de cada modo
Subtask	Card no Kanban / nó no grafo DAG
TaskBoard	Kanban com 5 colunas (uma por status)
WorkforceExecution	Página de monitoramento de execução
ExecutionMetrics	Painel de métricas com gráficos
Agent	Card de agente configurável
Toolkit / Tool	Lista de ferramentas registradas
TeamContext	Feed de mensagens entre agentes
DecisionMetadata	Painel de inteligência do planner
CriticResult	Badge de score + feedback inline no Subtask
HumanApprovalGate	Modal de aprovação/rejeição humana
ExecutionBudget	Formulário de orçamento de execução
🗂️ Páginas e Rotas
/ — Dashboard Principal
Cards de resumo: total de execuções, agentes ativos, subtarefas por status
Lista das execuções recentes com status geral e métricas rápidas
Botão de "Nova Execução"
/workforce/new — Configurador de Workforce
Aba 1 – Agentes: adicionar/remover agentes (nome, toolkit, max_concurrent)
Aba 2 – Padrão de Execução: selector visual para ExecutionMode (SUBAGENT / TEAM) e ExecutionPattern (SEQUENTIAL / PARALLEL / REVIEW_CRITIC / ITERATIVE_REFINEMENT / HUMAN_IN_THE_LOOP)
Aba 3 – Budget: campos para max_iterations, max_model_calls, max_elapsed_ms, quality_threshold
Aba 4 – Hooks & Critic: toggles para on_task_created, on_task_completed, critic, human_approval_gate, dynamic_router
Aba 5 – Objetivo: input de texto + lista de subtarefas planejadas (com dependências depends_on editáveis como DAG interativo)
/executions/:id — Monitor de Execução
Esta é a página central da aplicação. Dividida em 4 áreas:

① Topo — Status Bar

Badge do status global da WorkforceExecution
Indicadores de ExecutionMode e ExecutionPattern
Progress bar de subtarefas concluídas vs. total
② Centro-esquerda — Task Board (Kanban)

5 colunas: PENDING · RUNNING · COMPLETED · FAILED · BLOCKED
Cada card de Subtask mostra: descrição, tool_name, claimed_by, attempt, quality_score
Expansão do card: params, output, error, critic_feedback, metadata
③ Centro-direita — Grafo de Dependências (DAG)

Nós = subtarefas, arestas = depends_on
Coloração dinâmica por TaskStatus
Clique no nó abre o mesmo card detalhado do Kanban
④ Rodapé — Tabs

Eventos: log cronológico de execution.events (subtask_completed, subtask_retry, refinement_cycle, budget_exceeded, etc.)
Métricas: total_elapsed_ms, model_calls, iterations, critic_rejections, gráfico de latência por subtarefa
Team Context (visível apenas no modo TEAM): feed de mensagens entre agentes com sender, content, subtask_id
Decision Metadata: painel com recommended_agents, parallelism_worth_it, estimated_overhead, dependency_depth
/executions/:id/approve/:subtaskId — Aprovação Humana
Exibe output da subtarefa, quality_score, critic_feedback
Botões Aprovar / Rejeitar (mapeia o HumanApprovalGate)
Ativado automaticamente quando execution_pattern = HUMAN_IN_THE_LOOP
/agents — Gerenciador de Agentes
Lista de agentes cadastrados com nome, toolkit vinculado e max_concurrent
CRUD de agentes
/tools — Gerenciador de Toolkit
Lista de Tool registradas com nome e parâmetros aceitos
🧩 Componentes Principais
components/
├── layout/
│   ├── Sidebar.tsx            # Navegação lateral
│   └── TopBar.tsx             # Breadcrumb + status global
├── execution/
│   ├── KanbanBoard.tsx        # TaskBoard visual
│   ├── SubtaskCard.tsx        # Card individual de Subtask
│   ├── DAGViewer.tsx          # Grafo de dependências
│   ├── EventsLog.tsx          # Log de eventos
│   ├── MetricsPanel.tsx       # Gráficos e KPIs
│   ├── TeamContextFeed.tsx    # Mensagens em modo TEAM
│   └── DecisionPanel.tsx      # DecisionMetadata
├── configuration/
│   ├── WorkforceForm.tsx      # Configurador multi-aba
│   ├── AgentForm.tsx          # Formulário de agente
│   ├── BudgetForm.tsx         # ExecutionBudget
│   └── PatternSelector.tsx    # Selector visual de padrão
├── modals/
│   └── HumanApprovalModal.tsx # Gate de aprovação humana
└── shared/
    ├── StatusBadge.tsx        # Badge por TaskStatus
    ├── QualityScore.tsx       # Score visual (0–1)
    └── EmptyState.tsx
📦 Stack e Bibliotecas
Necessidade	Biblioteca
Roteamento	react-router
Ícones	lucide-react
Gráficos (métricas)	recharts
Grafo DAG	@xyflow/react (React Flow)
Animações	motion
Estado global	React Context + useReducer
Formulários	react-hook-form
🎨 Sistema de Cores por Status
Status	Cor
PENDING	slate
RUNNING	blue (pulsante)
COMPLETED	green
FAILED	red
BLOCKED	amber
🔢 Fases de Desenvolvimento Sugeridas
Fase	Entregável
1	Layout base + Dashboard + StatusBadge + mock data
2	Página de Execução: Kanban + Cards de Subtask
3	DAG Viewer com coloração por status
4	Events Log + Metrics Panel (recharts)
5	Configurador de Workforce (multi-aba)
6	Human Approval Modal + TeamContext Feed
7	CRUD de Agentes e Toolkit
8	Integração com backend real (API REST / WebSocket)
