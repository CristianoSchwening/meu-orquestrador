# Meu Orquestrador (Workforce)

A pure-Python multi-agent task orchestration library for planning, routing, and executing subtasks across agents with toolkit support.

## Run & Operate

- **Run tests:** `python3 -m pytest test_workforce.py -v`
- **Run demo:** `python3 app.py`
- **No env vars required**

## Stack

- Python 3.12
- Standard library only (no external runtime dependencies)
- `pytest` for testing

## Where things live

- `workforce.py` — core library: `Workforce`, `Agent`, `Toolkit`, `Subtask`, `TaskBoard`, `TeamContext`, `ExecutionMode`
- `app.py` — usage demo / entry point
- `test_workforce.py` — full test suite (11 tests)
- `docs/` — additional documentation

## Architecture decisions

- Thread-safe `TaskBoard` uses `threading.Lock` for claim coordination (single-process only)
- Two execution modes: `SUBAGENT` (isolated) and `TEAM` (shared `TeamContext`)
- `DecisionMetadata` computed at plan time to advise on parallelism worthiness
- Hook system (`on_task_created`, `on_task_completed`) allows policy enforcement without modifying core logic
- No external dependencies — intentional for portability and simplicity

## Product

- Register tools into `Toolkit`, assign toolkits to `Agent` instances
- Define a `planner` function that returns `Subtask` lists from an objective string
- Define a `task_router` to assign subtasks to named agents
- `Workforce.execute()` runs the plan, tracks status, emits events, and returns a `WorkforceExecution`

## User preferences

_None recorded yet_

## Gotchas

- `threading.Lock` only works within a single process — no distributed coordination
- `on_task_completed_rejection_status` must be `FAILED` or `PENDING` (raises `ValueError` otherwise)
- Tasks with missing dependency IDs are auto-set to `BLOCKED`

## Pointers

- See `README.md` for usage examples and execution mode documentation
