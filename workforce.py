from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Callable, Dict, List, Optional, Protocol, Any, Tuple
from threading import Lock
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
import uuid


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
class TaskBoard:
    subtasks: List[Subtask]
    subtask_map: Dict[str, Subtask] = field(init=False)
    _lock: Lock = field(default_factory=Lock, init=False, repr=False)

    def __post_init__(self) -> None:
        self.subtask_map = {subtask.id: subtask for subtask in self.subtasks}

    def claim_next(self, agent_name: str) -> Subtask | None:
        with self._lock:
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
                    continue

                if subtask.claimed_by is not None:
                    continue
                subtask.claimed_by = agent_name
                subtask.claimed_at = datetime.now(timezone.utc)
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
        decision_metadata = self._plan_decision_metadata(planned_subtasks)
        subtasks: List[Subtask] = []

        for subtask in planned_subtasks:
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

        task_board = TaskBoard(execution.subtasks)
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
