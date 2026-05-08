# Meu Orquestrador (Workforce)

A pure-Python multi-agent task orchestration library with a React + TypeScript frontend dashboard.

## Run & Operate

- **Run frontend (dev server):** workflow `Start application` → `npm run dev` → port 5000
- **Run tests:** `python3 -m pytest test_workforce.py -v`
- **Run Python demo:** `python3 app.py`
- **No env vars required**

## Stack

### Backend
- Python 3.12
- Standard library only + `concurrent.futures` for parallel execution
- `pytest` for testing

### Frontend
- React 18 + TypeScript
- Vite 6 (dev server on port 5000)
- Tailwind CSS 4
- react-router 7 (SPA routing)
- Recharts (metrics charts)
- Radix UI + shadcn/ui (component primitives)
- motion (Framer Motion) for animations
- react-hook-form for forms

## Where things live

### Backend
- `workforce.py` — core library (all public classes/enums)
- `app.py` — usage demo / entry point
- `test_workforce.py` — full test suite (31 tests)
- `docs/insights_google_agentic_patterns.md` — improvement roadmap (Google Agentic AI patterns)

### Frontend
- `src/main.tsx` — entry point
- `src/app/App.tsx` — router provider
- `src/app/routes.tsx` — route definitions
- `src/app/types/workforce.ts` — TypeScript types (aligned with Python backend)
- `src/app/data/mockData.ts` — mock executions, agents, tools, playground scenarios
- `src/app/pages/` — 7 pages (Playground, Dashboard, Executions, ExecutionDetail, WorkforceBuilder, Agents, Toolkit)
- `src/app/components/` — execution (KanbanBoard, DAGViewer, EventsLog, MetricsPanel, DecisionPanel, SubtaskCard), layout (AppShell), playground (AgentColumn), shared (StatusBadge, QualityScore), ui (shadcn primitives)
- `vite.config.ts` — Vite config (port 5000, host 0.0.0.0, allowedHosts: true)
- `index.html` — SPA entry HTML
- `package.json` — npm dependencies (react + react-dom moved from peerDeps to deps)

### Documentation
- `Spec Plan.md` — 8-phase development plan for the frontend
- `Front-Back.md` — gap analysis between Python backend types and frontend types
- `guidelines/Guidelines.md` — design system guidelines

## Routes

| Route | Page | Description |
|-------|------|-------------|
| `/` | PlaygroundPage | Chat interface + animated agent columns simulation |
| `/dashboard` | DashboardPage | KPI cards, weekly activity chart, recent executions |
| `/executions` | ExecutionsPage | Table with search + status filter |
| `/executions/:id` | ExecutionDetailPage | Kanban / DAG / Events / Metrics / Decision tabs |
| `/workforce` | WorkforceBuilderPage | 5-step wizard to configure and launch a workforce |
| `/agents` | AgentsPage | Full CRUD with modal form |
| `/toolkit` | ToolkitPage | Tool catalog by category |

## Architecture decisions (Python backend)

- Thread-safe `TaskBoard` uses `threading.Lock` for claim coordination (single-process only)
- Two execution modes: `SUBAGENT` (isolated) and `TEAM` (shared `TeamContext`)
- Five execution patterns: `SEQUENTIAL`, `PARALLEL`, `REVIEW_CRITIC`, `ITERATIVE_REFINEMENT`, `HUMAN_IN_THE_LOOP`
- `PARALLEL` pattern uses `ThreadPoolExecutor` — one worker thread per agent
- `DecisionMetadata` computed at plan time to advise on parallelism worthiness
- Hook system (`on_task_created`, `on_task_completed`) allows policy enforcement without modifying core logic
- `ExecutionBudget` enforces guardrails: `max_iterations`, `max_model_calls`, `max_elapsed_ms`, `quality_threshold`
- `ExecutionMetrics` tracks per-subtask latency, model calls, iteration count, and critic rejections
- `Agent.max_concurrent` limits simultaneous tasks; `TaskBoard` tracks active counts and enables capacity-based fallback routing
- `Workforce.dynamic_router` (`DynamicRouterFn`) re-routes pending tasks at runtime using a `RouterContext` snapshot
- `least_loaded_router` built-in helper always routes to the agent with the fewest active tasks
- `reroute_pending` calls the router outside the internal lock so slow routers don't block claiming
- No external runtime dependencies — intentional for portability and simplicity

## Product

- Register tools into `Toolkit`, assign toolkits to `Agent` instances
- Define a `planner` function that returns `Subtask` lists from an objective string
- Define a `task_router` to assign subtasks to named agents
- `Workforce.execute()` runs the plan, tracks status, emits events, returns a `WorkforceExecution`
- Optional `critic` function (`CriticFn`) enables validation/quality-gating per subtask
- Optional `human_approval_gate` for high-risk task approval flows
- `ExecutionBudget` limits cost/latency in iterative or critic-driven patterns
- `Agent.max_concurrent` + `Workforce.dynamic_router` enable capacity-aware, load-balanced routing
- `least_loaded_router(subtask, context)` — drop-in router that spreads work across available agents

## Frontend ↔ Backend alignment (see Front-Back.md)

Types are well-aligned. Three backend adjustments needed for real API integration:
1. Enrich `WorkforceExecution` with `task_name`, `objective`, `pattern`, `agent_ids`, `created_at`, `updated_at` at API layer
2. Add `timestamp` to all events emitted by the Python engine
3. Expose `agent.toolkit.tools.keys()` as a list of strings in the agents endpoint

## Pending frontend work (from Spec Plan.md)

- Phase 6: `HumanApprovalModal` + `TeamContextFeed` (not yet implemented)
- Phase 8: Real API integration (currently all mock data)

## User preferences

_None recorded yet_

## Gotchas

- `threading.Lock` only works within a single process — no distributed coordination
- `on_task_completed_rejection_status` must be `FAILED` or `PENDING` (raises `ValueError` otherwise)
- Tasks with missing dependency IDs are auto-set to `BLOCKED`
- `max_iterations` in `ExecutionBudget` counts retries for `REVIEW_CRITIC` and refinement cycles for `ITERATIVE_REFINEMENT`
- In `PARALLEL` mode, event ordering in `execution.events` is non-deterministic
- `react` and `react-dom` were moved from `peerDependencies` to `dependencies` in `package.json` to allow standalone Vite build
