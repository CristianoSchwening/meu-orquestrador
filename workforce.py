from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Callable, Dict, List, Optional, Protocol, Any
from threading import Lock
from datetime import datetime, timezone
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


@dataclass
class HookResult:
    allow: bool
    message: str = ""


@dataclass
class Agent:
    name: str
    toolkit: Toolkit

    def execute_subtask(self, task: Subtask) -> Subtask:
        task.status = TaskStatus.RUNNING
        try:
            task.output = self.toolkit.execute(task.tool_name, **task.params)
            task.status = TaskStatus.COMPLETED
        except Exception as exc:  # noqa: BLE001
            task.status = TaskStatus.FAILED
            task.error = str(exc)
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
class WorkforceExecution:
    task_id: str
    subtasks: List[Subtask]
    mode: ExecutionMode = ExecutionMode.SUBAGENT
    events: List[Dict[str, Any]] = field(default_factory=list)

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


@dataclass
class Workforce:
    planner: Planner
    agents: Dict[str, Agent]
    task_router: Callable[[Subtask], str]
    on_task_created: TaskCreatedHook | None = None
    on_task_completed: TaskCompletedHook | None = None
    on_task_completed_rejection_status: TaskStatus = TaskStatus.FAILED
    execution_mode: ExecutionMode = ExecutionMode.SUBAGENT

    def execute(self, task_id: str, objective: str) -> WorkforceExecution:
        if self.on_task_completed_rejection_status not in {TaskStatus.FAILED, TaskStatus.PENDING}:
            raise ValueError("on_task_completed_rejection_status must be FAILED or PENDING")

        planned_subtasks = self.planner(objective)
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

        execution = WorkforceExecution(task_id=task_id, subtasks=subtasks, mode=self.execution_mode)
        execution.events.append({"type": "execution_started", "mode": self.execution_mode.value})
        task_board = TaskBoard(execution.subtasks)
        team_context = TeamContext() if self.execution_mode == ExecutionMode.TEAM else None

        for subtask in execution.subtasks:
            subtask.metadata["routed_agent"] = self.task_router(subtask)

        while True:
            made_progress = False

            for agent_name in self.agents:
                subtask = task_board.claim_next(agent_name)
                if subtask is None:
                    continue

                if agent_name not in self.agents:
                    subtask.status = TaskStatus.FAILED
                    subtask.error = f"Agent '{agent_name}' not found"
                    execution.events.append(
                        {"type": "subtask_failed", "subtask_id": subtask.id, "reason": subtask.error}
                    )
                else:
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
                    self.agents[agent_name].execute_subtask(subtask)
                    if subtask.status == TaskStatus.COMPLETED:
                        execution.events.append(
                            {
                                "type": "subtask_completed",
                                "subtask_id": subtask.id,
                                "agent": agent_name,
                            }
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
                    if subtask.status == TaskStatus.COMPLETED and self.on_task_completed is not None:
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
                made_progress = True

            if not made_progress:
                break

        execution.events.append({"type": "execution_finished", "status": execution.status.value})

        return execution
