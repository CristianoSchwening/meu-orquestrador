# Meu Orquestrador (Workforce)

A pure-Python multi-agent task orchestration library for planning, routing, and executing subtasks across agents with toolkit support.

## Run & Operate

- **Run tests:** `python3 -m pytest test_workforce.py -v`
- **Run demo:** `python3 app.py`
- **No env vars required**

## Stack

- Python 3.12
- Standard library only + `concurrent.futures` for parallel execution
- `pytest` for testing

## Where things live

- `workforce.py` — core library (all public classes/enums)
- `app.py` — usage demo / entry point
- `test_workforce.py` — full test suite (23 tests)
- `docs/insights_google_agentic_patterns.md` — improvement roadmap (Google Agentic AI patterns)

## Architecture decisions

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

## User preferences

_None recorded yet_

## Gotchas

- `threading.Lock` only works within a single process — no distributed coordination
- `on_task_completed_rejection_status` must be `FAILED` or `PENDING` (raises `ValueError` otherwise)
- Tasks with missing dependency IDs are auto-set to `BLOCKED`
- `max_iterations` in `ExecutionBudget` counts retries (not total attempts) for `REVIEW_CRITIC`, and refinement cycles for `ITERATIVE_REFINEMENT`
- In `PARALLEL` mode, event ordering in `execution.events` is non-deterministic

## Pointers

- See `README.md` for usage examples and execution mode documentation
- See `docs/insights_google_agentic_patterns.md` for the improvement roadmap
