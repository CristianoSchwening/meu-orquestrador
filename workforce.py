from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Callable, Dict, List, Optional, Protocol, Any, Tuple
from threading import Lock
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
import uuid
import copy


class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    BLOCKED = "blocked"


class ExecutionMode(str, Enum):
    SUBAGENT = "subagent"
    TEAM = "team"


class ExecutionPattern(str, Enum):
    SEQUENTIAL = "sequential"
    PARALLEL = "parallel"
    REVIEW_CRITIC = "review_critic"
    ITERATIVE_REFINEMENT = "iterative_refinement"
    HUMAN_IN_THE_LOOP = "human_in_the_loop"


class Tool(Protocol):
    name: str

    def run(self, **kwargs: Any) -> Any:
        ...


@dataclass
class Toolkit:
    tools: Dict[str, Tool] = field(default_factory=dict)

    def register(self, tool: Tool) -> None:
        self.tools[tool.name] = tool

    def execute(self, tool_name: str, **kwargs: Any) -> Any:
        if tool_name not in self.tools:
            raise ValueError(f"Tool '{tool_name}' not available")
        return self.tools[tool_name].run(**kwargs)


@dataclass
class Subtask:
    description: str
    tool_name: str
    params: Dict[str, Any] = field(default_factory=dict)
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    depends_on: List[str] = field(default_factory=list)
    blocked_reason: str | None = None
    status: TaskStatus = TaskStatus.PENDING
    output: Optional[Any] = None
    error: Optional[str] = None
    claimed_by: str | None = None
    claimed_at: datetime | None = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    attempt: int = 0
    parent_subtask_id: str | None = None
    quality_score: float | None = None
    critic_feedback: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None


@dataclass
class RouterContext:
    """Snapshot of agent load state provided to a dynamic_router at routing time."""

    agent_loads: Dict[str, int]
    agent_capacities: Dict[str, int]
    available_agents: List[str]


@dataclass
class TaskBoard:
    subtasks: List[Subtask]
    agent_capacities: Dict[str, int] = field(default_factory=dict)
    subtask_map: Dict[str, Subtask] = field(init=False)
    _lock: Lock = field(default_factory=Lock, init=False, repr=False)
    _active_counts: Dict[str, int] = field(default_factory=dict, init=False)

    def __post_init__(self) -> None:
        self.subtask_map = {subtask.id: subtask for subtask in self.subtasks}

    @property
    def active_counts(self) -> Dict[str, int]:
        with self._lock:
            return dict(self._active_counts)

    def release(self, agent_name: str) -> None:
        with self._lock:
            self._active_counts[agent_name] = max(0, self._active_counts.get(agent_name, 0) - 1)

    def reroute_pending(
        self, router_fn: Callable[["Subtask"], str]
    ) -> List[Tuple[str, Optional[str], str]]:
        """Re-evaluate routing for all pending unclaimed subtasks.

        The router function is intentionally called *outside* the internal lock
        so that slow or blocking routers do not hold up other board operations.

        Returns a list of ``(subtask_id, old_route, new_route)`` for every
        subtask whose route was actually changed.
        """
        with self._lock:
            snapshot = [
                (subtask, subtask.metadata.get("routed_agent"))
                for subtask in self.subtasks
                if subtask.status == TaskStatus.PENDING and subtask.claimed_by is None
            ]

        proposed: List[Tuple["Subtask", Optional[str], str]] = [
            (subtask, old_route, router_fn(subtask)) for subtask, old_route in snapshot
        ]

        changes: List[Tuple[str, Optional[str], str]] = []
        with self._lock:
            for subtask, old_route, new_route in proposed:
                if subtask.status != TaskStatus.PENDING or subtask.claimed_by is not None:
                    continue
                if new_route != old_route:
                    subtask.metadata["routed_agent"] = new_route
                    changes.append((subtask.id, old_route, new_route))
        return changes

    def claim_next(self, agent_name: str) -> Subtask | None:
        with self._lock:
            capacity = self.agent_capacities.get(agent_name)
            if capacity is not None and self._active_counts.get(agent_name, 0) >= capacity:
                return None

            for subtask in self.subtasks:
                if subtask.status != TaskStatus.PENDING:
                    continue
                if subtask.metadata.get("completion_rejected_pending") is True:
                    continue

                if any(dep_id not in self.subtask_map for dep_id in subtask.depends_on):
                    missing = [dep_id for dep_id in subtask.depends_on if dep_id not in self.subtask_map]
                    subtask.status = TaskStatus.BLOCKED
                    subtask.blocked_reason = f"Missing dependencies: {', '.join(missing)}"
                    continue

                deps = [self.subtask_map[dep_id] for dep_id in subtask.depends_on]
                if any(dep.status == TaskStatus.FAILED for dep in deps):
                    failed_deps = [dep.id for dep in deps if dep.status == TaskStatus.FAILED]
                    subtask.status = TaskStatus.BLOCKED
                    subtask.blocked_reason = f"Blocked by failed dependencies: {', '.join(failed_deps)}"
                    continue

                if any(dep.status == TaskStatus.BLOCKED for dep in deps):
                    blocked_deps = [dep.id for dep in deps if dep.status == TaskStatus.BLOCKED]
                    subtask.status = TaskStatus.BLOCKED
                    subtask.blocked_reason = f"Blocked by blocked dependencies: {', '.join(blocked_deps)}"
                    continue

                if not all(dep.status == TaskStatus.COMPLETED for dep in deps):
                    continue

                route = subtask.metadata.get("routed_agent")
                if route is not None and route != agent_name:
                    preferred_capacity = self.agent_capacities.get(route)
                    if preferred_capacity is None:
                        continue
                    if self._active_counts.get(route, 0) < preferred_capacity:
                        continue

                if subtask.claimed_by is not None:
                    continue
                subtask.claimed_by = agent_name
                subtask.claimed_at = datetime.now(timezone.utc)
                self._active_counts[agent_name] = self._active_counts.get(agent_name, 0) + 1
                return subtask

        return None

    def reset_for_retry(self, subtask: Subtask) -> None:
        with self._lock:
            subtask.claimed_by = None
            subtask.claimed_at = None
            subtask.status = TaskStatus.PENDING
            subtask.metadata.pop("completion_rejected_pending", None)


@dataclass
class HookResult:
    allow: bool
    message: str = ""


@dataclass
class CriticResult:
    approved: bool
    score: float = 1.0
    feedback: str = ""


@dataclass
class ExecutionBudget:
    max_iterations: int | None = None
    max_model_calls: int | None = None
    max_elapsed_ms: float | None = None
    quality_threshold: float | None = None


@dataclass
class ExecutionMetrics:
    total_elapsed_ms: float = 0.0
    model_calls: int = 0
    iterations: int = 0
    critic_rejections: int = 0
    subtask_latencies: Dict[str, float] = field(default_factory=dict)
    _lock: Lock = field(default_factory=Lock, init=False, repr=False)

    def record_subtask(self, subtask: Subtask) -> None:
        if subtask.started_at and subtask.completed_at:
            latency_ms = (subtask.completed_at - subtask.started_at).total_seconds() * 1000
            with self._lock:
                self.subtask_latencies[subtask.id] = round(latency_ms, 2)
                self.model_calls += 1

    def as_dict(self) -> Dict[str, Any]:
        return {
            "total_elapsed_ms": round(self.total_elapsed_ms, 2),
            "model_calls": self.model_calls,
            "iterations": self.iterations,
            "critic_rejections": self.critic_rejections,
            "subtask_latencies": dict(self.subtask_latencies),
        }


@dataclass
class Agent:
    name: str
    toolkit: Toolkit
    max_concurrent: int | None = None

    def execute_subtask(self, task: Subtask) -> Subtask:
        task.status = TaskStatus.RUNNING
        task.started_at = datetime.now(timezone.utc)
        try:
            task.output = self.toolkit.execute(task.tool_name, **task.params)
            task.status = TaskStatus.COMPLETED
        except Exception as exc:  # noqa: BLE001
            task.status = TaskStatus.FAILED
            task.error = str(exc)
        task.completed_at = datetime.now(timezone.utc)
        return task


@dataclass
class TeamContext:
    messages: List[Dict[str, Any]] = field(default_factory=list)

    def publish(self, sender: str, content: Any, subtask_id: str | None = None) -> None:
        self.messages.append(
            {
                "sender": sender,
                "content": content,
                "subtask_id": subtask_id,
            }
        )

    def read_all(self) -> List[Dict[str, Any]]:
        return list(self.messages)


@dataclass
class DecisionMetadata:
    recommended_agents: int
    estimated_overhead: float
    independent_subtasks: int
    dependency_depth: int
    resource_conflict_score: float
    parallelism_worth_it: bool

    def as_dict(self) -> Dict[str, Any]:
        return {
            "recommended_agents": self.recommended_agents,
            "estimated_overhead": self.estimated_overhead,
            "independent_subtasks": self.independent_subtasks,
            "dependency_depth": self.dependency_depth,
            "resource_conflict_score": self.resource_conflict_score,
            "parallelism_worth_it": self.parallelism_worth_it,
        }


@dataclass
class WorkforceExecution:
    task_id: str
    subtasks: List[Subtask]
    mode: ExecutionMode = ExecutionMode.SUBAGENT
    events: List[Dict[str, Any]] = field(default_factory=list)
    decision_metadata: Dict[str, Any] = field(default_factory=dict)
    metrics: Dict[str, Any] = field(default_factory=dict)

    @property
    def status(self) -> TaskStatus:
        if all(st.status == TaskStatus.COMPLETED for st in self.subtasks):
            return TaskStatus.COMPLETED
        if any(st.status == TaskStatus.RUNNING for st in self.subtasks):
            return TaskStatus.RUNNING
        if any(st.status == TaskStatus.PENDING for st in self.subtasks):
            return TaskStatus.PENDING
        if any(st.status == TaskStatus.FAILED for st in self.subtasks):
            return TaskStatus.FAILED
        return TaskStatus.BLOCKED


Planner = Callable[[str], List[Subtask]]
TaskCreatedHook = Callable[[Subtask], HookResult]
TaskCompletedHook = Callable[[Subtask], HookResult]
CriticFn = Callable[[Subtask], CriticResult]
HumanApprovalGate = Callable[[Subtask], bool]
DynamicRouterFn = Callable[[Subtask, RouterContext], str]


def least_loaded_router(subtask: Subtask, context: RouterContext) -> str:
    """Built-in dynamic router that always routes to the agent with the fewest active tasks.

    When multiple agents share the same load, the first one in ``available_agents``
    is chosen (insertion order of the agents dict).  Falls back to the current
    static route when no agent information is available.
    """
    candidates = context.available_agents
    if not candidates:
        candidates = list(context.agent_capacities.keys())
    if not candidates:
        return subtask.metadata.get("routed_agent", "")
    return min(candidates, key=lambda a: context.agent_loads.get(a, 0))


@dataclass
class Workforce:
    planner: Planner
    agents: Dict[str, Agent]
    task_router: Callable[[Subtask], str]
    on_task_created: TaskCreatedHook | None = None
    on_task_completed: TaskCompletedHook | None = None
    on_task_completed_rejection_status: TaskStatus = TaskStatus.FAILED
    execution_mode: ExecutionMode = ExecutionMode.SUBAGENT
    execution_pattern: ExecutionPattern = ExecutionPattern.SEQUENTIAL
    budget: ExecutionBudget | None = None
    critic: CriticFn | None = None
    human_approval_gate: HumanApprovalGate | None = None
    dynamic_router: DynamicRouterFn | None = None


    def _clone_subtask(self, subtask: Subtask) -> Subtask:
        return Subtask(
            description=subtask.description,
            tool_name=subtask.tool_name,
            params=copy.deepcopy(subtask.params),
            id=subtask.id,
            depends_on=list(subtask.depends_on),
            blocked_reason=subtask.blocked_reason,
            status=subtask.status,
            output=subtask.output,
            error=subtask.error,
            claimed_by=subtask.claimed_by,
            claimed_at=subtask.claimed_at,
            metadata=copy.deepcopy(subtask.metadata),
            attempt=subtask.attempt,
            parent_subtask_id=subtask.parent_subtask_id,
            quality_score=subtask.quality_score,
            critic_feedback=subtask.critic_feedback,
            started_at=subtask.started_at,
            completed_at=subtask.completed_at,
        )


    def _validate_plan(self, subtasks: List[Subtask]) -> None:
        ids = [subtask.id for subtask in subtasks]
        seen: set[str] = set()
        duplicated: set[str] = set()
        for subtask_id in ids:
            if subtask_id in seen:
                duplicated.add(subtask_id)
            seen.add(subtask_id)
        if duplicated:
            dup_list = ", ".join(sorted(duplicated))
            raise ValueError(f"Duplicate subtask IDs: {dup_list}")

        id_set = set(ids)
        missing_dependencies: set[str] = set()
        missing_pairs: List[str] = []
        for subtask in subtasks:
            for dep_id in subtask.depends_on:
                if dep_id not in id_set:
                    missing_dependencies.add(dep_id)
                    missing_pairs.append(f"{subtask.id}->{dep_id}")
        if missing_dependencies:
            pairs = ", ".join(missing_pairs)
            missing_list = ", ".join(sorted(missing_dependencies))
            raise ValueError(
                f"Dependencies refer to unknown IDs: {missing_list} (references: {pairs})"
            )

        adjacency: Dict[str, List[str]] = {subtask.id: list(subtask.depends_on) for subtask in subtasks}
        colors: Dict[str, int] = {subtask_id: 0 for subtask_id in ids}
        stack: List[str] = []

        def dfs(node: str) -> List[str] | None:
            colors[node] = 1
            stack.append(node)
            for dep in adjacency[node]:
                if colors[dep] == 0:
                    cycle = dfs(dep)
                    if cycle is not None:
                        return cycle
                elif colors[dep] == 1:
                    start = stack.index(dep)
                    return stack[start:] + [dep]
            stack.pop()
            colors[node] = 2
            return None

        for subtask_id in ids:
            if colors[subtask_id] != 0:
                continue
            cycle = dfs(subtask_id)
            if cycle is not None:
                raise ValueError(f"Cycle detected: {' -> '.join(cycle)}")

    def _dependency_depth(self, subtasks: List[Subtask]) -> int:
        subtask_map = {subtask.id: subtask for subtask in subtasks}
        memo: Dict[str, int] = {}

        def depth(subtask_id: str) -> int:
            if subtask_id in memo:
                return memo[subtask_id]
            subtask = subtask_map[subtask_id]
            if not subtask.depends_on:
                memo[subtask_id] = 1
                return 1
            memo[subtask_id] = 1 + max(depth(dep_id) for dep_id in subtask.depends_on if dep_id in subtask_map)
            return memo[subtask_id]

        return max((depth(subtask.id) for subtask in subtasks), default=0)

    def _plan_decision_metadata(self, subtasks: List[Subtask]) -> DecisionMetadata:
        independent_subtasks = sum(1 for subtask in subtasks if not subtask.depends_on)
        dependency_depth = self._dependency_depth(subtasks)

        tool_counts: Dict[str, int] = {}
        for subtask in subtasks:
            tool_counts[subtask.tool_name] = tool_counts.get(subtask.tool_name, 0) + 1

        conflicts = sum(count - 1 for count in tool_counts.values() if count > 1)
        resource_conflict_score = conflicts / max(1, len(subtasks))

        estimated_overhead = round((dependency_depth * 0.4) + (resource_conflict_score * 0.6), 2)
        parallel_capacity = max(1, independent_subtasks - dependency_depth + 1)
        recommended_agents = max(1, min(parallel_capacity, len(self.agents)))
        parallelism_worth_it = independent_subtasks > 1 and recommended_agents > 1 and estimated_overhead < 0.9

        return DecisionMetadata(
            recommended_agents=recommended_agents,
            estimated_overhead=estimated_overhead,
            independent_subtasks=independent_subtasks,
            dependency_depth=dependency_depth,
            resource_conflict_score=round(resource_conflict_score, 2),
            parallelism_worth_it=parallelism_worth_it,
        )

    def _is_budget_exceeded(self, metrics: ExecutionMetrics, start: datetime) -> Tuple[bool, str]:
        if self.budget is None:
            return False, ""
        elapsed = (datetime.now(timezone.utc) - start).total_seconds() * 1000
        if self.budget.max_elapsed_ms is not None and elapsed > self.budget.max_elapsed_ms:
            return True, f"max_elapsed_ms ({self.budget.max_elapsed_ms}ms) exceeded"
        if self.budget.max_model_calls is not None and metrics.model_calls >= self.budget.max_model_calls:
            return True, f"max_model_calls ({self.budget.max_model_calls}) exceeded"
        if self.budget.max_iterations is not None and metrics.iterations >= self.budget.max_iterations:
            return True, f"max_iterations ({self.budget.max_iterations}) exceeded"
        return False, ""

    def _build_router_context(self, task_board: TaskBoard) -> RouterContext:
        loads = task_board.active_counts
        capacities = {
            name: agent.max_concurrent
            for name, agent in self.agents.items()
            if agent.max_concurrent is not None
        }
        available = [
            name
            for name in self.agents
            if capacities.get(name) is None or loads.get(name, 0) < capacities[name]
        ]
        return RouterContext(
            agent_loads=loads,
            agent_capacities=capacities,
            available_agents=available,
        )

    def _apply_dynamic_routing(
        self, execution: WorkforceExecution, task_board: TaskBoard
    ) -> None:
        if self.dynamic_router is None:
            return
        context = self._build_router_context(task_board)
        changes = task_board.reroute_pending(lambda subtask: self.dynamic_router(subtask, context))  # type: ignore[arg-type]
        for subtask_id, old_route, new_route in changes:
            execution.events.append(
                {
                    "type": "subtask_rerouted",
                    "subtask_id": subtask_id,
                    "from_agent": old_route,
                    "to_agent": new_route,
                }
            )

    def _apply_team_context(
        self,
        subtask: Subtask,
        team_context: TeamContext | None,
        execution: WorkforceExecution,
        agent_name: str,
    ) -> None:
        if team_context is not None:
            subtask.params.setdefault("team_context", team_context)
            execution.events.append(
                {
                    "type": "team_context_shared",
                    "subtask_id": subtask.id,
                    "agent": agent_name,
                    "messages_so_far": len(team_context.messages),
                }
            )

    def _apply_on_task_completed_hook(
        self,
        subtask: Subtask,
        execution: WorkforceExecution,
        task_board: TaskBoard,
    ) -> None:
        if subtask.status != TaskStatus.COMPLETED or self.on_task_completed is None:
            return
        hook_result = self.on_task_completed(subtask)
        subtask.metadata["on_task_completed"] = {
            "allow": hook_result.allow,
            "message": hook_result.message,
        }
        if not hook_result.allow:
            reason = hook_result.message or "Subtask rejected by on_task_completed hook"
            subtask.error = reason
            subtask.status = self.on_task_completed_rejection_status
            if self.on_task_completed_rejection_status == TaskStatus.PENDING:
                subtask.metadata["completion_rejected_pending"] = True

    def _apply_critic(
        self,
        subtask: Subtask,
        execution: WorkforceExecution,
        task_board: TaskBoard,
        metrics: ExecutionMetrics,
    ) -> bool:
        if subtask.status != TaskStatus.COMPLETED or self.critic is None:
            return True

        critic_result = self.critic(subtask)
        subtask.quality_score = critic_result.score
        subtask.critic_feedback = critic_result.feedback
        subtask.metadata["critic"] = {
            "approved": critic_result.approved,
            "score": critic_result.score,
            "feedback": critic_result.feedback,
        }

        threshold = self.budget.quality_threshold if self.budget else None
        auto_approved = threshold is not None and critic_result.score >= threshold
        approved = critic_result.approved or auto_approved

        if not approved:
            metrics.critic_rejections += 1
            max_iter = self.budget.max_iterations if self.budget else None
            if max_iter is None or subtask.attempt < max_iter:
                subtask.attempt += 1
                subtask.output = None
                subtask.error = None
                task_board.reset_for_retry(subtask)
                execution.events.append(
                    {
                        "type": "subtask_retry",
                        "subtask_id": subtask.id,
                        "attempt": subtask.attempt,
                        "critic_feedback": critic_result.feedback,
                    }
                )
                return False
            else:
                subtask.status = TaskStatus.FAILED
                subtask.error = f"Critic rejected after {subtask.attempt} attempts: {critic_result.feedback}"
                execution.events.append(
                    {
                        "type": "subtask_critic_exhausted",
                        "subtask_id": subtask.id,
                        "attempts": subtask.attempt,
                    }
                )
        return True

    def _apply_human_gate(
        self,
        subtask: Subtask,
        execution: WorkforceExecution,
        task_board: TaskBoard,
    ) -> bool:
        if subtask.status != TaskStatus.COMPLETED or self.human_approval_gate is None:
            return True

        approved = self.human_approval_gate(subtask)
        subtask.metadata["human_approval"] = {"approved": approved}

        if not approved:
            subtask.status = TaskStatus.FAILED
            subtask.error = "Rejected by human approval gate"
            execution.events.append({"type": "subtask_human_rejected", "subtask_id": subtask.id})
            return False

        execution.events.append({"type": "subtask_human_approved", "subtask_id": subtask.id})
        return True

    def _run_one_subtask(
        self,
        agent_name: str,
        subtask: Subtask,
        team_context: TeamContext | None,
        execution: WorkforceExecution,
        task_board: TaskBoard,
        metrics: ExecutionMetrics,
    ) -> None:
        self._apply_team_context(subtask, team_context, execution, agent_name)
        self.agents[agent_name].execute_subtask(subtask)
        metrics.record_subtask(subtask)

        if subtask.status == TaskStatus.COMPLETED:
            execution.events.append(
                {"type": "subtask_completed", "subtask_id": subtask.id, "agent": agent_name}
            )
        elif subtask.status == TaskStatus.FAILED:
            execution.events.append(
                {
                    "type": "subtask_failed",
                    "subtask_id": subtask.id,
                    "agent": agent_name,
                    "reason": subtask.error,
                }
            )

        self._apply_on_task_completed_hook(subtask, execution, task_board)

        if self.execution_pattern in (ExecutionPattern.REVIEW_CRITIC, ExecutionPattern.HUMAN_IN_THE_LOOP):
            self._apply_critic(subtask, execution, task_board, metrics)
            self._apply_human_gate(subtask, execution, task_board)

        task_board.release(agent_name)

    def _execute_sequential(
        self,
        execution: WorkforceExecution,
        task_board: TaskBoard,
        team_context: TeamContext | None,
        metrics: ExecutionMetrics,
        start: datetime,
    ) -> None:
        while True:
            exceeded, reason = self._is_budget_exceeded(metrics, start)
            if exceeded:
                execution.events.append({"type": "budget_exceeded", "reason": reason})
                break

            self._apply_dynamic_routing(execution, task_board)

            made_progress = False
            for agent_name in self.agents:
                subtask = task_board.claim_next(agent_name)
                if subtask is None:
                    continue
                self._run_one_subtask(agent_name, subtask, team_context, execution, task_board, metrics)
                made_progress = True

            if not made_progress:
                break

    def _execute_parallel(
        self,
        execution: WorkforceExecution,
        task_board: TaskBoard,
        team_context: TeamContext | None,
        metrics: ExecutionMetrics,
        start: datetime,
    ) -> None:
        def worker(agent_name: str) -> None:
            while True:
                exceeded, reason = self._is_budget_exceeded(metrics, start)
                if exceeded:
                    execution.events.append({"type": "budget_exceeded", "reason": reason})
                    break
                self._apply_dynamic_routing(execution, task_board)
                subtask = task_board.claim_next(agent_name)
                if subtask is None:
                    break
                self._run_one_subtask(agent_name, subtask, team_context, execution, task_board, metrics)

        with ThreadPoolExecutor(max_workers=len(self.agents)) as executor:
            futures = [executor.submit(worker, name) for name in self.agents]
            for f in futures:
                f.result()

    def _execute_iterative_refinement(
        self,
        execution: WorkforceExecution,
        task_board: TaskBoard,
        team_context: TeamContext | None,
        metrics: ExecutionMetrics,
        start: datetime,
    ) -> None:
        max_iter = self.budget.max_iterations if self.budget else None

        while True:
            exceeded, reason = self._is_budget_exceeded(metrics, start)
            if exceeded:
                execution.events.append({"type": "budget_exceeded", "reason": reason})
                break

            self._apply_dynamic_routing(execution, task_board)

            made_progress = False
            for agent_name in self.agents:
                subtask = task_board.claim_next(agent_name)
                if subtask is None:
                    continue
                self._run_one_subtask(agent_name, subtask, team_context, execution, task_board, metrics)
                made_progress = True

            if not made_progress:
                needs_refinement = False
                for subtask in execution.subtasks:
                    if subtask.status == TaskStatus.COMPLETED:
                        approved = self._apply_critic(subtask, execution, task_board, metrics)
                        if not approved:
                            needs_refinement = True

                if not needs_refinement:
                    break

                metrics.iterations += 1
                execution.events.append({"type": "refinement_cycle", "iteration": metrics.iterations})

                if max_iter is not None and metrics.iterations >= max_iter:
                    execution.events.append(
                        {"type": "max_iterations_reached", "iterations": metrics.iterations}
                    )
                    break

    def execute(self, task_id: str, objective: str) -> WorkforceExecution:
        if self.on_task_completed_rejection_status not in {TaskStatus.FAILED, TaskStatus.PENDING}:
            raise ValueError("on_task_completed_rejection_status must be FAILED or PENDING")

        planned_subtasks = self.planner(objective)
        isolated_planned_subtasks = [self._clone_subtask(subtask) for subtask in planned_subtasks]
        self._validate_plan(isolated_planned_subtasks)
        decision_metadata = self._plan_decision_metadata(isolated_planned_subtasks)
        subtasks: List[Subtask] = []

        for subtask in isolated_planned_subtasks:
            if self.on_task_created is None:
                subtasks.append(subtask)
                continue

            hook_result = self.on_task_created(subtask)
            subtask.metadata["on_task_created"] = {
                "allow": hook_result.allow,
                "message": hook_result.message,
            }
            if hook_result.allow:
                subtasks.append(subtask)
            else:
                reason = hook_result.message or "Subtask rejected by on_task_created hook"
                subtask.error = reason

        execution = WorkforceExecution(
            task_id=task_id,
            subtasks=subtasks,
            mode=self.execution_mode,
            decision_metadata=decision_metadata.as_dict(),
        )
        execution.events.append(
            {
                "type": "execution_started",
                "mode": self.execution_mode.value,
                "pattern": self.execution_pattern.value,
            }
        )

        agent_capacities = {
            name: agent.max_concurrent
            for name, agent in self.agents.items()
            if agent.max_concurrent is not None
        }
        task_board = TaskBoard(execution.subtasks, agent_capacities=agent_capacities)
        team_context = TeamContext() if self.execution_mode == ExecutionMode.TEAM else None
        metrics = ExecutionMetrics()
        start = datetime.now(timezone.utc)

        for subtask in execution.subtasks:
            subtask.metadata["routed_agent"] = self.task_router(subtask)

        if self.execution_pattern == ExecutionPattern.PARALLEL:
            self._execute_parallel(execution, task_board, team_context, metrics, start)
        elif self.execution_pattern == ExecutionPattern.ITERATIVE_REFINEMENT:
            self._execute_iterative_refinement(execution, task_board, team_context, metrics, start)
        else:
            self._execute_sequential(execution, task_board, team_context, metrics, start)

        metrics.total_elapsed_ms = (datetime.now(timezone.utc) - start).total_seconds() * 1000
        execution.metrics = metrics.as_dict()
        execution.events.append({"type": "execution_finished", "status": execution.status.value})

        return execution
